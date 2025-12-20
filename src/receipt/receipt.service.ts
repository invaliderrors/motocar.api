import { Injectable } from "@nestjs/common"
import * as puppeteer from "puppeteer"
import type { CreateReceiptDto } from "./dto"
import { templateHtml } from "./template"
import { WhatsappService } from "../whatsapp/whatsapp.service"
import { PrismaService } from "../prisma/prisma.service"
import { format, utcToZonedTime } from "date-fns-tz"
import { es } from "date-fns/locale"

@Injectable()
export class ReceiptService {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly prisma: PrismaService
  ) { }

  /**
   * Enrich DTO with data from database if installmentId or receiptNumber is provided
   * Maintains backward compatibility with frontend-calculated values
   */
  private async enrichDtoWithDatabaseData(dto: CreateReceiptDto): Promise<CreateReceiptDto> {
    // Use installmentId or receiptNumber to fetch installment data
    const installmentId = dto.installmentId || dto.receiptNumber;
    
    if (!installmentId) {
      return dto; // No ID provided, use frontend data as-is
    }

    try {
      const installment = await this.prisma.installment.findUnique({
        where: { id: installmentId },
        select: {
          daysBehind: true,
          daysAhead: true,
          isUpToDate: true,
          daysCoveredByPayment: true,
          exactInstallmentsOwed: true,
          remainingAmountOwed: true,
          remainingAmountOwedAfter: true,
          isLate: true,
          isAdvance: true,
          latePaymentDate: true,
          advancePaymentDate: true,
        },
      });

      if (!installment) {
        console.log(`Installment ${installmentId} not found, using frontend data`);
        return dto;
      }

      // Prefer database values over frontend values (database is source of truth)
      // Only override if database value exists (not null/undefined)
      const enrichedDto = { ...dto };

      if (installment.daysBehind !== null && installment.daysBehind !== undefined) {
        enrichedDto.daysBehind = installment.daysBehind;
      }
      if (installment.daysAhead !== null && installment.daysAhead !== undefined) {
        enrichedDto.daysAhead = installment.daysAhead;
      }
      if (installment.isUpToDate !== null && installment.isUpToDate !== undefined) {
        enrichedDto.isUpToDate = installment.isUpToDate;
      }
      if (installment.daysCoveredByPayment !== null && installment.daysCoveredByPayment !== undefined) {
        // Store for potential future use
        (enrichedDto as any).daysCoveredByPayment = installment.daysCoveredByPayment;
      }
      if (installment.exactInstallmentsOwed !== null && installment.exactInstallmentsOwed !== undefined) {
        enrichedDto.exactInstallmentsOwed = installment.exactInstallmentsOwed;
      }
      if (installment.remainingAmountOwed !== null && installment.remainingAmountOwed !== undefined) {
        enrichedDto.remainingAmountOwed = installment.remainingAmountOwed;
      }
      if (installment.remainingAmountOwedAfter !== null && installment.remainingAmountOwedAfter !== undefined) {
        (enrichedDto as any).remainingAmountOwedAfter = installment.remainingAmountOwedAfter;
      }
      if (installment.isLate !== null && installment.isLate !== undefined) {
        enrichedDto.isLate = installment.isLate;
      }
      if (installment.isAdvance !== null && installment.isAdvance !== undefined) {
        enrichedDto.isAdvance = installment.isAdvance;
      }
      if (installment.latePaymentDate) {
        enrichedDto.latePaymentDate = installment.latePaymentDate.toISOString();
      }
      if (installment.advancePaymentDate) {
        enrichedDto.advancePaymentDate = installment.advancePaymentDate.toISOString();
      }

      console.log('Enriched DTO with database data:', {
        installmentId,
        daysBehind: enrichedDto.daysBehind,
        daysAhead: enrichedDto.daysAhead,
        isUpToDate: enrichedDto.isUpToDate,
        hasExactOwed: !!enrichedDto.exactInstallmentsOwed,
        exactInstallmentsOwed: enrichedDto.exactInstallmentsOwed,
        remainingAmountOwed: enrichedDto.remainingAmountOwed,
        storedFromDB: {
          daysBehind: installment.daysBehind,
          daysAhead: installment.daysAhead,
          isUpToDate: installment.isUpToDate,
        }
      });

      return enrichedDto;
    } catch (error) {
      console.error('Error fetching installment data:', error);
      return dto; // Fall back to frontend data on error
    }
  }

  async generateReceipt(dto: any): Promise<Buffer> {
    // Enrich DTO with database data if available
    const enrichedDto = await this.enrichDtoWithDatabaseData(dto);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const page = await browser.newPage()
    const html = await this.fillTemplate(enrichedDto)

    // Use 'load' instead of 'networkidle0' to avoid timeout issues with inline content
    await page.setContent(html, { 
      waitUntil: "load",
      timeout: 10000 
    })

    const pdfBuffer = await page.pdf({
      width: "80mm",
      printBackground: true,
      margin: { top: "5mm", bottom: "5mm", left: "5mm", right: "5mm" },
      preferCSSPageSize: true,
    })

    await browser.close()
    return Buffer.from(pdfBuffer)
  }

  private async fillTemplate(dto: CreateReceiptDto): Promise<string> {
    console.log("=== RECEIPT GENERATION START ===");
    console.log("paymentDate en DTO:", dto.paymentDate);
    console.log("isLate:", dto.isLate);
    console.log("latePaymentDate:", dto.latePaymentDate);
    console.log("isAdvance:", dto.isAdvance);
    console.log("advancePaymentDate:", dto.advancePaymentDate);
    console.log("storeId received:", dto.storeId);
    console.log("Stored status fields:", {
      daysBehind: dto.daysBehind,
      daysAhead: dto.daysAhead,
      isUpToDate: dto.isUpToDate,
      exactInstallmentsOwed: dto.exactInstallmentsOwed,
      remainingAmountOwed: dto.remainingAmountOwed,
    });
    
    // Fetch store information if storeId is provided
    let storeName = "MotoFácil";
    let storeNit = "";
    
    if (dto.storeId) {
      try {
        const store = await this.prisma.store.findUnique({
          where: { id: dto.storeId },
          select: { name: true, nit: true }
        });
        
        if (store) {
          storeName = store.name;
          storeNit = store.nit;
          console.log("Store found:", { name: storeName, nit: storeNit });
        } else {
          console.log("Store not found for ID:", dto.storeId);
        }
      } catch (error) {
        console.error("Error fetching store information:", error);
      }
    } else {
      console.log("No storeId provided in DTO");
    }
    
    // First, calculate daysInAdvance to verify if it's truly an advance payment
    let daysInAdvance: number | null = null;
    
    if (dto.isAdvance && dto.advancePaymentDate) {
      if (dto.daysAhead !== undefined && dto.daysAhead !== null) {
        // daysAhead from frontend is negative for advance, convert to positive
        // Ensure it's a number and round to 1 decimal place
        daysInAdvance = Math.abs(Number(dto.daysAhead));
      } else {
        // Fallback to calculating if not provided
        daysInAdvance = this.calculateDaysInAdvance(new Date(), new Date(dto.advancePaymentDate));
      }
    }
    
    // Determine payment type and display date based on actual days
    // 1. Late payment: show latePaymentDate (original due date) in red
    // 2. Advance payment: show advancePaymentDate (future due date) in blue - only if daysAhead > 0
    // 3. On-time payment: show paymentDate (actual payment date) in normal color
    let displayDate: Date;
    let paymentType: 'late' | 'advance' | 'ontime';
    
    if (dto.isLate && dto.latePaymentDate) {
      displayDate = new Date(dto.latePaymentDate);
      paymentType = 'late';
    } else if (dto.isAdvance && dto.advancePaymentDate && daysInAdvance !== null && daysInAdvance > 0) {
      // Only treat as advance if truly ahead (daysInAdvance > 0)
      displayDate = new Date(dto.advancePaymentDate);
      paymentType = 'advance';
    } else {
      displayDate = new Date(dto.paymentDate);
      paymentType = 'ontime';
    }

    // Calculate days since last payment or days in advance
    // Use pre-calculated values from frontend if available, otherwise calculate
    let daysSinceLastPayment: number | null = null;
    let installmentsInAdvance: number = 0;
    
    if (paymentType === 'advance' && daysInAdvance !== null) {
      
      // Calculate installments covered by advance payment
      // For daily frequency: 1 day = 1 installment
      if (daysInAdvance !== null) {
        if (dto.paymentFrequency === 'DAILY') {
          installmentsInAdvance = daysInAdvance;
        } else if (dto.paymentFrequency === 'WEEKLY') {
          installmentsInAdvance = Math.floor(daysInAdvance / 7 * 10) / 10; // One decimal
        } else if (dto.paymentFrequency === 'BIWEEKLY') {
          installmentsInAdvance = Math.floor(daysInAdvance / 14 * 10) / 10; // One decimal
        } else if (dto.paymentFrequency === 'MONTHLY') {
          installmentsInAdvance = Math.floor(daysInAdvance / 30 * 10) / 10; // One decimal
        }
      }
    } else if (paymentType === 'late') {
      // Use pre-calculated daysBehind from frontend if available
      if (dto.daysBehind !== undefined && dto.daysBehind !== null) {
        // Ensure it's a number
        daysSinceLastPayment = Number(dto.daysBehind);
      } else if (dto.lastPaymentDate) {
        // Fallback to calculating if not provided
        daysSinceLastPayment = this.calculateDaysSinceLastPayment(dto.lastPaymentDate);
      } else {
        daysSinceLastPayment = dto.daysSinceLastPayment ?? null;
      }
    }

    // Format payment status information with fractional installments
    let paymentStatus = "";
    let cuotasRestanteInfo = "";
    let saldoRestanteMoto = "";
    let saldoRestanteGps = "";
    
    // Show "cuotas atrasadas" section - this shows debt BEFORE this payment
    // PRIORITY 1: Use exactInstallmentsOwed and remainingAmountOwed (stored snapshot BEFORE payment)
    // PRIORITY 2: Calculate from dates (old logic)
    const shouldShowDebtSection = (dto.exactInstallmentsOwed !== undefined && dto.exactInstallmentsOwed > 0) || 
                                   (paymentType === 'late' && daysSinceLastPayment !== null && daysSinceLastPayment > 0);
    
    if (shouldShowDebtSection) {
      // Use exact calculated values if provided (BEFORE payment snapshot)
      let installmentsOwed = 0;
      let owedMotoDebt = 0;
      let owedGpsDebt = 0;
      
      if (dto.exactInstallmentsOwed !== undefined && dto.remainingAmountOwed !== undefined) {
        // Use exact values from the stored snapshot (debt BEFORE payment)
        installmentsOwed = dto.exactInstallmentsOwed;
        
        // Split remaining amount between base and GPS based on daily rates
        const amountPerInstallment = dto.installmentPaymentAmmount ?? dto.amount ?? 0;
        const gpsPerInstallment = dto.gps || 0;
        const totalPerInstallment = amountPerInstallment + gpsPerInstallment;
        
        if (totalPerInstallment > 0) {
          owedMotoDebt = (amountPerInstallment / totalPerInstallment) * dto.remainingAmountOwed;
          owedGpsDebt = (gpsPerInstallment / totalPerInstallment) * dto.remainingAmountOwed;
        }
      } else if (paymentType === 'late' && daysSinceLastPayment !== null) {
        // Fall back to old estimation logic (calculate from dates)
        if (dto.paymentFrequency === 'DAILY') {
          installmentsOwed = daysSinceLastPayment;
        } else if (dto.paymentFrequency === 'WEEKLY') {
          installmentsOwed = Math.floor(daysSinceLastPayment / 7 * 10) / 10; // One decimal
        } else if (dto.paymentFrequency === 'BIWEEKLY') {
          installmentsOwed = Math.floor(daysSinceLastPayment / 14 * 10) / 10; // One decimal
        } else if (dto.paymentFrequency === 'MONTHLY') {
          installmentsOwed = Math.floor(daysSinceLastPayment / 30 * 10) / 10; // One decimal
        } else {
          // Default to daily if frequency is not specified
          installmentsOwed = daysSinceLastPayment;
        }
        
        // Calculate debt using old method
        const amountPerInstallment = dto.installmentPaymentAmmount ?? dto.amount ?? 0;
        const gpsPerInstallment = dto.gps || 0;
        owedMotoDebt = installmentsOwed * amountPerInstallment;
        owedGpsDebt = installmentsOwed * gpsPerInstallment;
      }
      
      // Format with 2 decimal places for precision
      const installmentsOwedFormatted = installmentsOwed.toFixed(2);
      
      cuotasRestanteInfo = `CUOTAS ATRASADAS: ${installmentsOwedFormatted}`;
      
      if (installmentsOwed > 0) {
        saldoRestanteMoto = `MOTO ATRASADO: ${this.formatCurrency(owedMotoDebt, true)}`;
        saldoRestanteGps = `GPS ATRASADO: ${this.formatCurrency(owedGpsDebt, true)}`;
      }
    }

    // Add payment status based on type
    let paymentDaysStatus = "";
    let paymentTypeLabel = "";
    let messageBottom = "";
    let advanceInfo = "";
    
    // Check if we have stored status from database (new installments)
    const hasStoredStatus = dto.daysBehind !== undefined || dto.daysAhead !== undefined || dto.isUpToDate !== undefined;
    
    if (hasStoredStatus && dto.isUpToDate) {
      // Loan is exactly up to date after payment (stored status)
      paymentTypeLabel = "PAGO AL DÍA";
      paymentDaysStatus = "Estado: Al día (no debe nada)";
      messageBottom = "¡Excelente! Mantienes tus pagos al día. Sigue así para alcanzar tu meta.";
    } else if (hasStoredStatus && dto.daysAhead !== undefined && dto.daysAhead > 0) {
      // Loan is ahead after payment (stored status)
      paymentTypeLabel = "PAGO ADELANTADO";
      const daysFormatted = dto.daysAhead.toFixed(1);
      paymentDaysStatus = `Estado: ${daysFormatted} día${dto.daysAhead !== 1 ? 's' : ''} adelantado`;
      
      // Calculate installments covered for advance
      if (dto.paymentFrequency === 'DAILY') {
        installmentsInAdvance = dto.daysAhead;
      } else if (dto.paymentFrequency === 'WEEKLY') {
        installmentsInAdvance = Math.floor(dto.daysAhead / 7 * 10) / 10;
      } else if (dto.paymentFrequency === 'BIWEEKLY') {
        installmentsInAdvance = Math.floor(dto.daysAhead / 14 * 10) / 10;
      } else if (dto.paymentFrequency === 'MONTHLY') {
        installmentsInAdvance = Math.floor(dto.daysAhead / 30 * 10) / 10;
      }
      
      if (installmentsInAdvance > 0) {
        const installmentsFormatted = installmentsInAdvance % 1 === 0 
          ? installmentsInAdvance.toString() 
          : installmentsInAdvance.toFixed(1);
        advanceInfo = `Cuotas adelantadas: ${installmentsFormatted}`;
      }
      
      messageBottom = "¡Felicidades! Estás adelantado en tus pagos. Continúa así para estar cada vez más cerca de tu meta.";
    } else if (hasStoredStatus && dto.daysBehind !== undefined && dto.daysBehind > 0) {
      // Still behind after payment (stored status)
      paymentTypeLabel = "PAGO ATRASADO";
      
      // Use stored amount owed AFTER payment, or calculate if not available
      let totalOwed = 0;
      if ((dto as any).remainingAmountOwedAfter !== undefined && (dto as any).remainingAmountOwedAfter !== null) {
        // Use stored value directly (most accurate)
        totalOwed = (dto as any).remainingAmountOwedAfter;
      } else {
        // Fallback: calculate from daysBehind using daily rates
        const amountPerInstallment = dto.installmentPaymentAmmount ?? 0;
        const gpsPerInstallment = 0; // We don't have the GPS daily rate in DTO, need to calculate from loan
        totalOwed = dto.daysBehind * (amountPerInstallment + gpsPerInstallment);
      }
      
      const daysFormatted = dto.daysBehind.toFixed(2);
      paymentDaysStatus = `Estado: ${daysFormatted} día${dto.daysBehind !== 1 ? 's' : ''} atrasado - Debe ${this.formatCurrency(totalOwed, true)} para estar al día`;
      messageBottom = "Recuerda mantener tus pagos al día para evitar cargos adicionales.";
    } else if (paymentType === 'late' && daysSinceLastPayment !== null) {
      // LEGACY: Fall back to old calculation for old installments
      // Check if there WAS debt BEFORE this payment (exactInstallmentsOwed)
      // If there was accumulated debt, it's a late payment even if they cleared it all
      const hadAccumulatedDebt = dto.exactInstallmentsOwed && dto.exactInstallmentsOwed > 0;
      
      // Only mark as "al día" if paid on time AND there was NO accumulated debt
      if (daysSinceLastPayment === 0 && !hadAccumulatedDebt) {
        paymentTypeLabel = "PAGO AL DÍA";
        paymentDaysStatus = "Estado: Al día";
        messageBottom = "¡Excelente! Mantienes tus pagos al día. Sigue así para alcanzar tu meta.";
      } else {
        paymentTypeLabel = "PAGO ATRASADO";
        
        // Use exact values if provided, otherwise fall back to old calculation
        let installmentsOwedDisplay = 0;
        let totalOwed = 0;
        
        if (dto.exactInstallmentsOwed !== undefined && dto.remainingAmountOwed !== undefined) {
          // Use exact calculated values
          installmentsOwedDisplay = dto.exactInstallmentsOwed;
          totalOwed = dto.remainingAmountOwed;
        } else {
          // Fall back to old estimation logic
          let installmentsOwed = 0;
          if (dto.paymentFrequency === 'DAILY') {
            installmentsOwed = daysSinceLastPayment;
          } else if (dto.paymentFrequency === 'WEEKLY') {
            installmentsOwed = Math.floor(daysSinceLastPayment / 7 * 10) / 10;
          } else if (dto.paymentFrequency === 'BIWEEKLY') {
            installmentsOwed = Math.floor(daysSinceLastPayment / 14 * 10) / 10;
          } else if (dto.paymentFrequency === 'MONTHLY') {
            installmentsOwed = Math.floor(daysSinceLastPayment / 30 * 10) / 10;
          } else {
            installmentsOwed = daysSinceLastPayment;
          }
          
          installmentsOwedDisplay = installmentsOwed;
          const amountPerInstallment = dto.installmentPaymentAmmount ?? dto.amount ?? 0;
          const gpsPerInstallment = (dto.gps || 0);
          totalOwed = (installmentsOwed * amountPerInstallment) + (installmentsOwed * gpsPerInstallment);
        }
        
        // Format with 2 decimal places for exact precision
        const daysFormatted = installmentsOwedDisplay.toFixed(2);
        
        paymentDaysStatus = `Estado: ${daysFormatted} día${installmentsOwedDisplay !== 1 ? 's' : ''} atrasado - Debe ${this.formatCurrency(totalOwed, true)} para estar al día`;
        messageBottom = "Recuerda mantener tus pagos al día para evitar cargos adicionales.";
      }
    } else if (paymentType === 'advance') {
      paymentTypeLabel = "PAGO ADELANTADO";
      
      if (daysInAdvance !== null && daysInAdvance > 0) {
        // Format days with one decimal place, show as positive value
        const daysFormatted = daysInAdvance.toFixed(1);
        paymentDaysStatus = `Estado: ${daysFormatted} día${daysInAdvance !== 1 ? 's' : ''} (adelantado)`;
      } else {
        paymentDaysStatus = "Estado: Adelantado";
      }
      
      // Show installments covered if calculated
      if (installmentsInAdvance > 0) {
        const installmentsFormatted = installmentsInAdvance % 1 === 0 
          ? installmentsInAdvance.toString() 
          : installmentsInAdvance.toFixed(1);
        advanceInfo = `Cuotas adelantadas: ${installmentsFormatted}`;
      }
      
      messageBottom = "¡Felicidades! Estás adelantado en tus pagos. Continúa así para estar cada vez más cerca de tu meta.";
    } else {
      paymentTypeLabel = "PAGO AL DÍA";
      paymentDaysStatus = "Estado: Al día";
      messageBottom = "¡Excelente! Mantienes tus pagos al día. Sigue así para alcanzar tu meta.";
    }

    // Translate payment method to Spanish
    const paymentMethodLabels = {
      'CASH': 'EFECTIVO',
      'CARD': 'TARJETA',
      'TRANSACTION': 'TRANSFERENCIA'
    };
    const paymentMethodLabel = paymentMethodLabels[dto.paymentMethod as keyof typeof paymentMethodLabels] || dto.paymentMethod || 'EFECTIVO';

    const data = {
      ...dto,
      storeName,
      storeNit,
      formattedAmount: this.formatCurrency(dto.amount),
      formattedGps: this.formatCurrency(dto.gps || 0),
      formattedTotal: this.formatCurrency((dto.amount || 0) + (dto.gps || 0)),
      formattedDate: this.formatDate(dto.date),
      concept: dto.concept || "Monto",
      formattedPaymentDate: this.formatDateOnly(displayDate),
      formattedGeneratedDate: this.formatDate(new Date()),
      notes: dto.notes || "Administrador",
      paymentMethod: paymentMethodLabel,
      paymentStatus,
      cuotasRestanteInfo,
      saldoRestanteMoto,
      saldoRestanteGps,
      paymentDaysStatus,
      paymentTypeLabel,
      messageBottom,
      advanceInfo,
      daysSinceLastPayment: daysSinceLastPayment ?? 0,
      daysInAdvance: daysInAdvance ?? 0,
      installmentsInAdvance,
      isLate: paymentType === 'late',
      isAdvance: paymentType === 'advance',
      isOnTime: paymentType === 'ontime',
    };

    return templateHtml
      .replace(/{{storeName}}/g, data.storeName)
      .replace(/{{storeNit}}/g, data.storeNit)
      .replace(/{{name}}/g, data.name)
      .replace(/{{identification}}/g, data.identification)
      .replace(/{{concept}}/g, data.concept)
      .replace(/{{formattedAmount}}/g, data.formattedAmount)
      .replace(/{{formattedGps}}/g, data.formattedGps)
      .replace(/{{formattedTotal}}/g, data.formattedTotal)
      .replace(/{{formattedDate}}/g, data.formattedDate)
      .replace(/{{paymentDate}}/g, data.formattedPaymentDate)
      .replace(/{{generatedDate}}/g, data.formattedGeneratedDate)
      .replace(/{{notes}}/g, data.notes)
      .replace(/{{paymentStatus}}/g, data.paymentStatus)
      .replace(/{{cuotasRestanteInfo}}/g, data.cuotasRestanteInfo)
      .replace(/{{saldoRestanteMoto}}/g, data.saldoRestanteMoto)
      .replace(/{{saldoRestanteGps}}/g, data.saldoRestanteGps)
      .replace(/{{paymentDaysStatus}}/g, data.paymentDaysStatus)
      .replace(/{{paymentTypeLabel}}/g, data.paymentTypeLabel)
      .replace(/{{messageBottom}}/g, data.messageBottom)
      .replace(/{{advanceInfo}}/g, data.advanceInfo)
      .replace(/{{daysSinceLastPayment}}/g, String(data.daysSinceLastPayment))
      .replace(/{{daysInAdvance}}/g, String(data.daysInAdvance))
      .replace(/{{installmentsInAdvance}}/g, String(data.installmentsInAdvance))
      .replace(/{{isLate}}/g, data.isLate ? 'true' : 'false')
      .replace(/{{isAdvance}}/g, data.isAdvance ? 'true' : 'false')
      .replace(/{{isOnTime}}/g, data.isOnTime ? 'true' : 'false')
      .replace(/{{paymentMethod}}/g, data.paymentMethod) 
  }

  /**
   * Round to the nearest 50 COP
   * Examples: 91.315 -> 91.300, 91.340 -> 91.350, 91.370 -> 91.400
   */
  private roundToNearest50(value: number): number {
    return Math.round(value / 50) * 50;
  }

  private formatCurrency(value: number, shouldRound: boolean = false): string {
    const finalValue = shouldRound ? this.roundToNearest50(value) : value;
    const formatted = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(finalValue)
    // Replace $ with COP for clarity
    return formatted.replace('$', 'COP ')
  }

  private formatDate(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return "—"
    const timeZone = "America/Bogota"

    const raw = typeof dateInput === "string" ? dateInput : dateInput.toISOString()
    const utcDate = new Date(raw.endsWith("Z") ? raw : `${raw}Z`)
    const zoned = utcToZonedTime(utcDate, timeZone)

    return format(zoned, "dd 'de' MMMM 'de' yyyy, hh:mm aaaa", { timeZone })
  }

  private formatDateOnly(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return "—"
    
    // Parse UTC date and format as date only (no time, no timezone conversion)
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()
    const day = date.getUTCDate()
    
    // Create a local date with the UTC components to avoid timezone shift
    const localDate = new Date(year, month, day)
    
    return format(localDate, "dd 'de' MMMM 'de' yyyy", { locale: es })
  }

  private calculateDaysSinceLastPayment(lastPaymentDate: string | Date): number {
    const timeZone = "America/Bogota"
    
    // Convert last payment date to Colombian timezone
    const lastPayment = typeof lastPaymentDate === "string" 
      ? new Date(lastPaymentDate) 
      : lastPaymentDate
    const start = utcToZonedTime(lastPayment, timeZone)
    
    // Get current date in Colombian timezone
    const now = new Date()
    const end = utcToZonedTime(now, timeZone)
    
    // Normalize to start of day for both dates
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    
    // Calculate difference in days (including all days Monday-Sunday)
    const diffTime = Math.abs(endDay.getTime() - startDay.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(0, diffDays)
  }

  private calculateDaysInAdvance(fromDate: Date, toDate: Date): number {
    const timeZone = "America/Bogota"
    
    // Convert both dates to Colombian timezone
    const start = utcToZonedTime(fromDate, timeZone)
    const end = utcToZonedTime(toDate, timeZone)
    
    // Normalize to start of day for both dates
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    
    let count = 0
    const cursor = new Date(startDay)
    cursor.setDate(cursor.getDate() + 1) // Start from tomorrow
    
    while (cursor <= endDay) {
      // Count all days (no Sunday exclusion as per new requirements)
      count++
      cursor.setDate(cursor.getDate() + 1)
    }
    
    return Math.max(0, count)
  }

  private generateReceiptNumber(uuid: string): string {
    const cleanId = uuid.replace(/-/g, "")
    const lastFive = cleanId.slice(-5)
    return lastFive.toUpperCase()
  }

  async sendReceiptViaWhatsapp(
    storeId: string,
    phoneNumber: string,
    dto: CreateReceiptDto,
    caption?: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const pdfBuffer = await this.generateReceipt(dto)

      // Always send as PDF with fixed caption and filename
      const fileName = `Recibo_${this.generateReceiptNumber(dto.receiptNumber)}.pdf`
      const base64 = pdfBuffer.toString("base64")

      return await this.whatsappService.sendMediaBase64(storeId, {
        number: phoneNumber,
        mediatype: "document",
        mimetype: "application/pdf",
        caption: caption || `Recibo #${this.generateReceiptNumber(dto.receiptNumber)}`,
        media: base64,
        fileName,
      })
    } catch (error) {
      return {
        success: false,
        error: `Failed to send receipt via WhatsApp: ${error.message}`,
      }
    }
  }
}
