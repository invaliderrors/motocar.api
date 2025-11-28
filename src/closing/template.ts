export const templateHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Cierre de Caja</title>
  <style>
    @page {
      size: 210mm 297mm; /* A4 size */
      margin: 10mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: sans-serif;
      font-size: 12px;
      color: #000;
      background-color: #fff;
    }

    .closing-report {
      width: 100%;
    }

    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ccc;
    }

    .logo {
      width: 120px;
      height: auto;
      margin: 0 auto 10px;
    }

    .title {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 6px;
    }

    .info {
      font-size: 14px;
      margin-bottom: 4px;
    }

    .section {
      margin-top: 20px;
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }

    .summary-box {
      border: 1px solid #ccc;
      padding: 10px;
      margin-bottom: 15px;
      border-radius: 4px;
    }

    .summary-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }

    .summary-item.total {
      font-weight: bold;
      border-top: 1px solid #ccc;
      padding-top: 5px;
      margin-top: 5px;
    }

    .label {
      font-weight: bold;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    .table th, .table td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid #ddd;
    }

    .table th {
      background-color: #f2f2f2;
      font-weight: bold;
    }

    .right {
      text-align: right;
    }

    .center {
      text-align: center;
    }

    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    
    .payment-methods, .expense-categories {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    
    .method-box, .category-box {
      border: 1px solid #ddd;
      padding: 8px;
      border-radius: 4px;
      flex: 1;
      min-width: 120px;
      text-align: center;
    }
    
    .method-box .amount, .category-box .amount {
      font-weight: bold;
      font-size: 14px;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="closing-report">
    <div class="header">
      <img class="logo" src="https://i.imgur.com/vxqGDAf.png" alt="Logo">
      <div class="title">CIERRE DE CAJA {{provider}}</div>
      <div class="info">Cierre ID: {{id}}</div>
      <div><span class="label">Fecha:</span> {{formattedDate}}</div>
      <div><span class="label">Generado:</span> {{formattedGeneratedDate}}</div>
      <div><span class="label">Creado por:</span> {{createdBy}}</div>
    </div>

    <div class="section">
      <div class="section-title">Resumen</div>
      <div class="summary-box">
        <div class="summary-item">
          <span>Recaudo de Vehículos:</span>
          <span>{{formattedTotalBasePayments}}</span>
        </div>
        <div class="summary-item">
          <span>Recaudo de GPS:</span>
          <span>{{formattedTotalGpsPayments}}</span>
        </div>
        <div class="summary-item">
          <span>Total Ingresos:</span>
          <span>{{formattedTotalPayments}}</span>
        </div>
        <div class="summary-item">
          <span>Total Egresos:</span>
          <span>{{formattedTotalExpenses}}</span>
        </div>
        <div class="summary-item total">
          <span>Balance:</span>
          <span>{{formattedBalance}}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Efectivo en Caja</div>
      <div class="summary-box">
        <div class="summary-item">
          <span>Efectivo en Caja:</span>
          <span>{{formattedCashInRegister}}</span>
        </div>
        <div class="summary-item">
          <span>Transferencias:</span>
          <span>{{formattedCashFromTransfers}}</span>
        </div>
        <div class="summary-item">
          <span>Tarjetas:</span>
          <span>{{formattedCashFromCards}}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Recaudo de Vehículos por Método de Pago</div>
      <div class="payment-methods">
        {{basePaymentMethods}}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Recaudo de GPS por Método de Pago</div>
      <div class="payment-methods">
        {{gpsPaymentMethods}}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Total por Método de Pago (Vehículos + GPS)</div>
      <div class="payment-methods">
        {{paymentMethods}}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Categorías de Egresos</div>
      <div class="expense-categories">
        {{expenseCategories}}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Detalle de Pagos</div>
      <table class="table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Placa</th>
            <th>Fecha</th>
            <th>Método</th>
            <th class="right">Vehículo</th>
            <th class="right">GPS</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          {{paymentRows}}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Detalle de Egresos</div>
      <table class="table">
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Beneficiario</th>
            <th>Fecha</th>
            <th>Método</th>
            <th class="right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {{expenseRows}}
        </tbody>
      </table>
    </div>

    {{#if notes}}
    <div class="section">
      <div class="section-title">Notas</div>
      <div>{{notes}}</div>
    </div>
    {{/if}}

    <div class="footer">
      <div>Este documento es un comprobante oficial de cierre de caja.</div>
      <div>Generado el {{formattedGeneratedDate}}</div>
    </div>
  </div>
</body>
</html>
`;
