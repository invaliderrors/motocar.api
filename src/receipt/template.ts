export const templateHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Recibo</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 5mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: sans-serif;
      font-size: 18px;
      color: #000;
      background-color: #fff;
      width: 80mm;
    }

    .receipt {
      width: 100%;
    }

    .header {
      text-align: center;
      margin-bottom: 12px;
    }

    .title {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 6px;
    }

    .info {
      font-size: 18px;
      margin-bottom: 4px;
    }

    .section {
      margin-top: 14px;
      margin-bottom: 14px;
    }

    .label {
      font-weight: bold;
      margin-bottom: 2px;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }

    .table th, .table td {
      text-align: left;
      padding: 6px 0;
      font-size: 18px;
      border-bottom: 1px dashed #000;
    }

    .right {
      text-align: right;
    }

    .total {
      font-size: 20px;
      font-weight: bold;
      text-align: right;
      margin-top: 12px;
      border-top: 1px solid #000;
      padding-top: 6px;
    }

    .notes {
      margin-top: 12px;
      font-size: 17px;
    }

    .thank-you {
      font-weight: bold;
      font-size: 18px;
      margin-top: 14px;
    }

    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 17px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="title">RECIBO DE PAGO</div>
      <div><span class="label">Generado:</span> {{generatedDate}}</div>
    </div>

    <div class="section">
      <div>PLACA: <strong>{{identification}}</strong></div>
      <div><span class="label">NIT:</span> {{storeNit}}</div>
      <div><span class="label">FECHA:</span> {{paymentDate}}</div>
      <div><span class="label">CLIENTE:</span> {{name}}</div>
      <div><span class="label">MEDIO DE PAGO:</span> {{paymentMethod}}</div>
    </div>

    <table class="table" style="margin-top: 8px; margin-bottom: 0;">
      <tr>
        <td style="border: none; padding: 4px 0;">VALOR PAGADO:</td>
        <td class="right" style="border: none; padding: 4px 0;">{{formattedAmount}}</td>
      </tr>
      <tr>
        <td style="border: none; padding: 4px 0;">VALOR GPS:</td>
        <td class="right" style="border: none; padding: 4px 0;">{{formattedGps}}</td>
      </tr>
      <tr style="border-top: 2px solid #000;">
        <td style="font-weight: bold; padding: 6px 0;">TOTAL:</td>
        <td class="right" style="font-weight: bold; padding: 6px 0;">{{formattedTotal}}</td>
      </tr>
    </table>

    <div style="margin-top: 12px; padding-top: 8px; border-top: 2px solid #000;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; font-size: 17px;">{{cuotasRestanteInfo}}</td>
          <td style="padding: 4px 0; text-align: right; font-size: 17px;"></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 17px;">{{saldoRestanteMoto}}</td>
          <td style="padding: 4px 0; text-align: right; font-size: 17px;"></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 17px;">{{saldoRestanteGps}}</td>
          <td style="padding: 4px 0; text-align: right; font-size: 17px;"></td>
        </tr>
      </table>
      <div style="text-align: center; font-size: 16px; margin-top: 8px; margin-bottom: 4px;">
        ::{{paymentTypeLabel}}::
      </div>
      <div style="font-size: 18px; font-weight: bold; margin-top: 6px; text-align: center;">{{paymentDaysStatus}}</div>
      <div style="font-size: 17px; font-weight: bold; margin-top: 6px; color: #0066cc; text-align: center;">{{advanceInfo}}</div>
    </div>

    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #000; text-align: center;">
      <div style="font-size: 16px; line-height: 1.4; font-style: italic;">{{messageBottom}}</div>
    </div>

    <div class="footer">
      <div class="thank-you">¡Gracias por su pago!</div>
      <div style="margin-top: 6px; font-size: 16px;">Usuario: {{notes}}</div>
    </div>
  </div>
</body>
</html>
`;
