export const contractTemplate = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Contrato de Renting</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Lora:wght@400;500;600;700&display=swap');
    
    body {
      font-family: 'Crimson Pro', serif;
      line-height: 1.6;
      font-size: 14px;
      color: #000000;
      background-color: #fff;
      margin: 0;
      padding: 0;
    }
    
    .contract-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 40px 50px;
      background-color: #fff;
    }
    
    h1, h2, h3 {
      font-family: 'Lora', serif;
      text-align: center;
      font-weight: 700;
      margin-bottom: 16px;
      color: #000000;
    }
    
    h1 {
      font-size: 24px;
      margin-top: 24px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    
    h2 {
      font-size: 20px;
      margin-top: 16px;
      color: #000000;
    }
    
    h3 {
      font-size: 16px;
      margin-top: 32px;
      text-align: left;
      border-bottom: 1px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 16px;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    p {
      margin: 12px 0;
      text-align: justify;
      hyphens: auto;
    }
    
    strong {
      color: #000000;
      font-weight: 700;
    }
    
    .highlight {
      color: #000000;
      font-weight: 700;
    }
    
    .logo {
      display: block;
      margin: 0 auto 20px auto;
      max-height: 100px;
    }
    
    .company-info {
      text-align: center;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    
    .vehicle-table {
      width: 100%;
      margin: 20px 0 30px 0;
      border-collapse: collapse;
    }
    
    .vehicle-table th,
    .vehicle-table td {
      padding: 10px;
      text-align: left;
      border: 1px solid #000000;
    }
    
    .vehicle-table th {
      font-weight: 700;
      background-color: #f5f5f5;
    }
    
    ol {
      margin-left: 24px;
      padding-left: 16px;
    }
    
    ol[type="A"] > li {
      margin-bottom: 16px;
      text-align: justify;
      position: relative;
    }
    
    hr {
      margin: 30px 0;
      border: none;
      border-top: 1px solid #000000;
    }
    
    .signature-block {
      margin-top: 50px;
      display: flex;
      justify-content: space-between;
    }
    
    .signature {
      width: 45%;
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #000000;
    }
    
    .signature p {
      margin: 4px 0;
      text-align: center;
    }
    
    .footer {
      text-align: center;
      font-size: 12px;
      color: #000000;
      margin-top: 50px;
      border-top: 1px solid #000000;
      padding-top: 10px;
    }
    
    .clause-title {
      font-weight: 700;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .section-title {
      text-align: center;
      font-weight: 700;
      margin: 20px 0 10px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    @media print {
      .contract-container {
        padding: 20px;
      }
      
      body {
        background: white;
      }
      
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="contract-container">
    <img src="https://i.imgur.com/w9K9wWP.png" alt="Logo de la empresa" class="logo" />
    <div class="company-info">
      <p>
        <strong class="highlight">MOTOFACIL DEL ATLANTICO</strong>
        <br />
        NIT: <strong>1088023193-3</strong>
        <br />
        Carrera 21 B #65C-32 Local 2 San Felipe
        <br />
        Correo Electrónico: <strong>motofacilatlantico@gmail.com</strong>
        <br />
        Cel: <strong>3122905385</strong>
      </p>
    </div>

    <h2>
      Contrato de Renting N° <span class="highlight">{{contractNumber}}</span>
    </h2>

    <p class="section-title">
      <strong>REUNIDOS</strong>
    </p>
    <p>
      <strong>{{legalRepresentative}}</strong>, mayor de edad identificado con cédula de ciudadanía Nro. 
      <strong>{{representativeId}}</strong>, representante legal de la Sociedad 
      <strong class="highlight">MOTO FACIL DEL ATLANTICO</strong>, distinguida con el NIT. 
      <strong>1.088.023.193-3</strong> y Matricula N° 912.843 de fecha 10 de abril de 2025, con domicilio en la ciudad
      de Barranquilla, departamento del Atlántico, ubicado en la 
      <strong>CARRERA 21B # 65C – 32 LOCAL 2 SAN FELIPE</strong>, teléfono <strong>3122905385</strong>, correo
      electrónico: <strong>motofacilatlantico@gmail.com</strong>, a partir de ahora, 
      <strong class="highlight">ARRENDADOR</strong>, de una parte;
    </p>

    <p>
      <strong>{{customerName}}</strong>, identificado con la cédula de ciudadanía N° 
      <strong>{{customerId}}</strong>, con domicilio en {{customerCity}}, residente en el inmueble
      ubicado en <strong>{{customerAddress}}</strong>, portador del número telefónico 
      <strong>{{customerPhone}}</strong>, quien a partir de ahora se denomina 
      <strong class="highlight">ARRENDATARIO</strong>, de otra parte.
    </p>

    <p>
      Acuerdan celebrar el presente <strong class="highlight">CONTRATO DE RENTING</strong>, con opción de compra
      sobre el vehículo que se describe a continuación y en atención a las siguientes:
    </p>

    <h3>Identificación del Vehículo</h3>
    <table class="vehicle-table">
      <tbody>
        <tr>
          <th>PLACA</th>
          <td>
            <strong>{{plate}}</strong>
          </td>
        </tr>
        <tr>
          <th>MARCA</th>
          <td>
            <strong>{{brand}}</strong>
          </td>
        </tr>
        <tr>
          <th>MOTOR</th>
          <td>
            <strong>{{engine}}</strong>
          </td>
        </tr>
        <tr>
          <th>MODELO</th>
          <td>
            <strong>{{model}}</strong>
          </td>
        </tr>
        <tr>
          <th>CHASIS</th>
          <td>
            <strong>{{chassis}}</strong>
          </td>
        </tr>
      </tbody>
    </table>

    <h3>Estipulaciones</h3>
    <p>
      <span class="clause-title">Cláusula Primera:</span> La empresa 
      <strong class="highlight">MOTOFACIL DEL ATLANTICO</strong> entrega en arriendo, con opción de compra a 
      <strong>{{customerName}}</strong>, identificado con la cédula de ciudadanía Nro. 
      <strong>{{customerId}}</strong>, el vehículo motocicleta de su propiedad especificada en el presente
      contrato para <strong>uso personal</strong>, sin que la misma pueda ser utilizada para fines distintos sin
      autorización expresa de la empresa arrendadora.
    </p>

    <p>
      <span class="clause-title">Cláusula Segunda:</span> El <strong>ARRENDATARIO</strong> inspeccionará el
      vehículo motocicleta confirmando que se encuentra en <strong>perfecto estado</strong> para el uso al que va a
      ser destinado y verificará que los documentos se encuentren al día.
    </p>

    <p>
      <span class="clause-title">Cláusula Tercera:</span> El <strong>ARRENDATARIO</strong> leerá de manera
      integral las estipulaciones de este contrato y solicitará las aclaraciones respectivas sobre los puntos que no
      entienda.
    </p>

    <p>
      <span class="clause-title">Cláusula Cuarta:</span> El canon y/o precio del arrendamiento es de 
      <strong class="highlight">dieciocho mil pesos ($18.000) diarios</strong>, durante la vigencia del presente
      contrato, la cual será de <strong class="highlight">dieciocho (18) meses</strong>.
    </p>

    <p>
      <span class="clause-title">Cláusula Quinta:</span> Acuerdan las partes que la renta se pagará sin excepción
      alguna en el domicilio principal de la empresa arrendadora sin falta. <strong>DIARIAMENTE</strong> en los
      horarios establecidos por la empresa (lunes a viernes 8:00am a 12:00pm – 2:00pm a 6:00pm y sábados 8:00am a
      12:00pm)...
    </p>

    <p>
      <span class="clause-title">Cláusula Sexta:</span> Las partes acuerdan que el <strong>ARRENDATARIO</strong> 
      se obliga y asume la <strong>responsabilidad integral</strong> del mantenimiento del vehículo motocicleta,
      impuestos, daños a terceros, infracciones de tránsito de cualquier naturaleza, infracciones y/o conductas
      penales y civiles ocasionadas con la motocicleta o en los hechos donde esta se vea involucrada.
    </p>

    <p>
      <span class="clause-title">Cláusula Séptima:</span> Las partes acuerdan que durante la vigencia del presente
      contrato la empresa arrendadora asume la obligación correspondiente a la expedición del 
      <strong>SOAT y Tecnomecánica</strong> del respectivo vehículo durante la vigencia del presente contrato.
    </p>

    <p>
      <strong>Parágrafo 1:</strong> El <strong>ARRENDATARIO</strong> es responsable de notificar a la empresa sobre el
      vencimiento del SOAT y/o Tecnomecánica.
    </p>

    <p>
      <strong>Parágrafo 2:</strong> Del mismo modo, el <strong>ARRENDATARIO</strong> está obligado a llevar el
      vehículo objeto del presente contrato al CDA o a quien haga sus veces siempre y cuando concurra previa
      autorización de la empresa arrendadora.
    </p>

    <p>
      <strong>Parágrafo 3:</strong> En el evento en el que al <strong>ARRENDATARIO</strong> le caduque el SOAT o
      Tecnomecánica y no atienda las órdenes e instrucciones que realice la empresa arrendadora en orden a renovarlos,
      será responsable el <strong>ARRENDATARIO</strong> integralmente de las sanciones de tránsito, civiles, penales y
      administrativas que se deriven por su renuencia.
    </p>

    <p>
      <span class="clause-title">Cláusula Octava:</span> Si el <strong>ARRENDATARIO</strong> incumple la
      obligación de pago de las rentas respectivas, la empresa arrendadora podrá unilateralmente terminar el contrato
      y quedará facultada para exigir la <strong>restitución inmediata</strong> de la motocicleta objeto del contrato.
      Dicha restitución deberá realizarse sin necesidad de requerimiento judicial ni autorización adicional, quedando
      el <strong>ARRENDATARIO</strong> obligado a entregar el vehículo en las mismas condiciones en las que le fue
      entregado, salvo el desgaste normal por uso adecuado; sin derecho a exigir el <strong>ARRENDATARIO</strong> 
      reembolso alguno.
    </p>

    <p>
      <span class="clause-title">Cláusula Novena:</span> Para resolver cualquier cuestión derivada del presente
      contrato las partes se someten expresamente a acudir a un centro de conciliación autorizado de manera previa y
      posteriormente la jurisdicción civil de Colombia en cuanto a que en este consta una obligación clara, expresa y
      exigible y presta este mérito ejecutivo.
    </p>

    <p>
      <span class="clause-title">Cláusula Décima:</span> Se estipula que el <strong>ARRENDATARIO</strong> asume
      por concepto de GPS, la suma de <strong class="highlight">dos mil pesos ($2.000) diarios</strong> el cual se
      instalará en la motocicleta objeto del contrato para brindar seguridad a su movilidad y garantizar la integridad
      del vehículo.
    </p>

    <p>
      <span class="clause-title">Cláusula Undécima:</span> El <strong>ARRENDATARIO</strong> autoriza de manera
      libre y voluntaria a la empresa arrendadora para 
      <strong>monitorear e inspeccionar integralmente su ubicación en tiempo real</strong> durante la vigencia de este
      contrato.
    </p>

    <p>
      <span class="clause-title">Cláusula Duodécima:</span> El <strong>ARRENDATARIO</strong>, autoriza, acepta y
      asume la prohibición de manipular, retirar o averiar el GPS del vehículo arrendado, cualquier novedad con el
      GPS, debe inmediatamente informar a la empresa arrendadora.
    </p>

    <p>
      <span class="clause-title">Cláusula Decimotercera:</span> El <strong>ARRENDATARIO</strong>, autoriza, acepta
      y asume la prohibición de manipular, retirar o averiar LA BATERÍA del vehículo arrendado, cualquier novedad con
      LA BATERÍA, debe inmediatamente informar a la empresa arrendadora.
    </p>

    <h3>Estipulaciones para Opción de Compra del Vehículo Motocicleta</h3>
    <p>
      <span class="clause-title">Primera:</span> El <strong>ARRENDATARIO</strong> cuya calidad en este evento es
      compradora, (ahora en adelante se denominará comprador) deberá cancelar 
      <strong class="highlight">Catorce mil pesos ($14.000) diarios</strong> adicionales a la tarifa estipulada en
      la Cláusula Cuarta del presente contrato, <strong>Dieciocho mil pesos ($18.000)</strong> (canon de
      arrendamiento), de la misma forma y adicional a estos montos deberá cancelar la tarifa estipulada en la Cláusula
      Décima por concepto de GPS, la suma de <strong>dos mil pesos ($2.000) diarios</strong>, para una totalidad de
      pago diario de: <strong class="highlight">Treinta y Cuatro Mil pesos ($ 34.000)</strong> durante la vigencia
      mencionada, la cual es de <strong>Dieciocho (18) meses</strong>, que equivale a 540 días.
    </p>

    <p>
      <span class="clause-title">Segunda:</span> Si el comprador (<strong>ARRENDATARIO</strong>) decide dar por
      terminado este contrato antes del plazo estipulado en la Cláusula Cuarta; es decir, 
      <strong>Dieciocho (18) meses</strong>, renuncia al dinero entregado bajo este concepto, sin que haya lugar a
      reembolso.
    </p>

    <p>
      <span class="clause-title">Tercera:</span> Se estipula por las partes como sanción la terminación unilateral
      del contrato por parte de la empresa arrendadora, si el <strong>ARRENDATARIO</strong> se sustrae u omite
      cancelar el canon respectivo junto con la cuota de opción de comprar o incumple alguna de las estipulaciones
      consignadas en el presente contrato sin derecho a reembolso alguno.
    </p>

    <p>
      <span class="clause-title">Tercera:</span> En este evento (ESTIPULACIÓN TERCERA) el 
      <strong>ARRENDADOR</strong> quedará facultado para exigir la restitución inmediata de la motocicleta objeto del
      contrato. Dicha restitución deberá realizarse sin necesidad de requerimiento judicial ni autorización adicional,
      quedando el <strong>ARRENDATARIO</strong> obligado a entregar el vehículo en las mismas condiciones en las que
      le fue entregado, salvo el desgaste normal por uso adecuado.
    </p>

    <p>
      <span class="clause-title">Cuarta:</span> Se estipula y se acuerda por las partes que los gastos económicos
      del traspaso los asume la empresa arrendadora. Se advierte y se acuerda por las partes que dicho concepto es
      exclusivo del valor que solicita las autoridades de tránsito administrativas en cuanto a pago por concepto de
      traspaso, no se incluye otro concepto que sea condicionante para la materialización de este; es decir,
      impuestos, infracciones de tránsito y/o concepto que deba ser cancelado previo al traspaso es responsabilidad
      exclusiva del <strong>ARRENDATARIO</strong> o comprador del vehículo.
    </p>

    <h3>De las Otras Obligaciones del Arrendatario y/o Comprador</h3>

    <ol type="A">
      <li>
        Las partes acuerdan que, queda <strong>prohibido</strong> al <strong>ARRENDATARIO</strong> y/o comprador,
        variar cualquier característica del vehículo, así como efectuar cualquier modificación de su interior o
        exterior, so pena de asumir los gastos respectivos o reacondicionamiento del vehículo a su estado original,
        sin perjuicio de la terminación unilateral del contrato por parte de la empresa arrendadora.
      </li>

      <li>
        <strong class="highlight">SUBARRIENDO Y CESIÓN.</strong> El <strong>ARRENDATARIO</strong> no tiene la
        facultad y le queda prohibido ceder el uso, arriendo o subarrendar la motocicleta objeto del contrato a menos
        de que medie autorización expresa de la empresa arrendadora. Incurrir en estos eventos el 
        <strong>ARRENDATARIO</strong>, la empresa arrendadora queda facultada para terminar unilateralmente el
        contrato y exigir la entrega inmediata del vehículo motocicleta, sin derecho a exigir reembolso el 
        <strong>ARRENDATARIO</strong> y/o comprador por ningún concepto o indemnización.
      </li>

      <li>
        Las partes acuerdan que, los días pico y placa y festivos <strong>no están exentos</strong> de la renta y
        tarifa de opción de compra.
      </li>

      <li>
        Las partes acuerdan y estipulan que la integridad física tanto exterior e interior del vehículo motocicleta es
        responsabilidad del <strong>ARRENDATARIO</strong> y/o comprador.
      </li>

      <li>
        El buen uso de la motocicleta es responsabilidad exclusiva del <strong>ARRENDATARIO</strong> y/o comprador.
      </li>

      <li>
        Las partes acuerdan que los comparendos o infracciones de tránsito de cualquier naturaleza o policivas en las
        que se vea involucrada la motocicleta deben ser canceladas o subsanadas en un término de 
        <strong>tres (3) días hábiles</strong> por parte del <strong>ARRENDATARIO</strong> y/o comprador so pena de la
        terminación unilateral del presente contrato por parte de la empresa arrendadora, la cual quedará facultada
        para exigir la restitución inmediata de la motocicleta objeto del contrato. Dicha restitución deberá
        realizarse sin necesidad de requerimiento judicial ni autorización adicional, quedando el 
        <strong>ARRENDATARIO</strong> obligado a entregar el vehículo en las mismas condiciones en las que le fue
        entregado, salvo el desgaste normal por uso adecuado; sin derecho de exigir el <strong>ARRENDATARIO</strong> 
        indemnización alguna.
      </li>

      <li>
        Las partes acuerdan que, si el <strong>ARRENDATARIO</strong> y/o comprador se retrasa 
        <strong>dos cuotas diarias</strong> por concepto de renta y/o tarifa de opción de compra, la empresa 
        <strong>MOTOFACIL DEL ATLANTICO</strong> está facultada para proceder con la terminación unilateral del
        contrato y exigir la restitución inmediata de la motocicleta objeto del contrato. Dicha restitución deberá
        realizarse sin necesidad de requerimiento judicial ni autorización adicional, quedando el 
        <strong>ARRENDATARIO</strong> obligado a entregar el vehículo en las mismas condiciones en las que le fue
        entregado, salvo el desgaste normal por uso adecuado, sin derecho a rembolso alguno por ningún concepto.
      </li>

      <li>
        Las partes acuerdan que, el <strong>ARRENDATARIO</strong> y/o comprador faculta, autoriza y acepta que la
        omisión o transgresión de cualquier acuerdo u obligación estipulada en este contrato faculta a la empresa 
        <strong>MOTOFACIL DEL ATLANTICO</strong> para dar por terminado unilateralmente el contrato y proceder con la
        restitución material del vehículo motocicleta, sin requerimiento judicial ni requerimiento previo; sin derecho
        a rembolso alguno, por concepto de pago de tarifa de opción de compra ni por ningún otro concepto.
      </li>

      <li>
        Las partes acuerdan que, la empresa <strong>MOTOFACIL DEL ATLANTICO</strong> está facultada para exigir la
        restitución inmediata de la motocicleta objeto del contrato. Dicha restitución deberá realizarse sin necesidad
        de requerimiento judicial ni autorización adicional, quedando el <strong>ARRENDATARIO</strong> obligado a
        entregar el vehículo en las mismas condiciones en las que le fue entregado, salvo el desgaste normal por uso
        adecuado. Se insiste en que el <strong>ARRENDATARIO</strong> y/o comprador inmerso en algún incumplimiento u
        omisión no podrá oponerse a dicha restitución.
      </li>

      <li>
        El <strong>ARRENDATARIO</strong> autoriza, se compromete y se obliga a atender cualquier requerimiento que le
        haga el administrador y/o representante legal de la empresa arrendadora.
      </li>

      <li>
        El <strong>ARRENDATARIO</strong> se compromete y se obliga a cumplir con las normas de tránsito, conducir de
        acuerdo con el Código Nacional de Tránsito y respetar su vida y la vida de terceros.
      </li>

      <li>
        Se le informa al <strong>ARRENDATARIO</strong> que la conducción del vehículo motocicleta dentro del
        ordenamiento jurídico colombiano es considerada una <strong>actividad peligrosa</strong>, por lo cual será
        responsable de cualquier daño o perjuicio que cause a la motocicleta o a un tercero.
      </li>

      <li>
        El <strong>ARRENDATARIO</strong> se obliga a usar siempre el casco autorizado por las autoridades de tránsito
        nacionales cuando conduzca el vehículo motocicleta objeto de este contrato.
      </li>

      <li>
        <strong class="highlight">PARÁGRAFO 1.</strong> Las partes acuerdan que el <strong>ARRENDATARIO</strong> 
        y/o comprador no queda exonerado de la obligación consignada en la estipulación general Nro. tres (III) y la
        Nro. primera (1) del acápite de opción de compra del vehículo motocicleta, por concepto de incapacidades
        médicas. Es decir, el término de incapacidad médica no modifica la duración del contrato ni el valor de las
        cuotas.
      </li>

      <li>
        <strong class="highlight">PARÁGRAFO 2.</strong> Con la firma del contrato se hace entrega material de la
        motocicleta al <strong>ARRENDATARIO</strong> y/o comprador, quien desde ese momento es responsable de su
        integridad externa e interna.
      </li>

      <li>
        <strong class="highlight">AUTORIZACIÓN DE TRATAMIENTO DE DATOS PERSONALES:</strong> El 
        <strong>ARRENDATARIO</strong> y/o comprador autoriza expresamente a la empresa arrendadora y/o vendedora para
        recolectar, almacenar, utilizar, circular, contactar, procesar, transferir, suprimir o tratar sus datos
        personales para fines comerciales, estadísticos, administrativos, preventa y posventa. Así mismo, declara
        haber sido informado sobre el tratamiento y sus derechos.
      </li>

      <li>
        Se le informó al <strong>ARRENDATARIO</strong> y/o comprador sobre la finalidad del tratamiento de datos, sus
        derechos como titular, en especial a conocer, actualizar, rectificar y suprimir sus datos personales, y sobre
        el carácter facultativo de respuestas relacionadas con datos sensibles o de menores de edad.
      </li>

      <li>
        <strong class="highlight">ACUERDO ÚNICO:</strong> Este contrato representa el acuerdo completo entre las
        partes respecto a su objeto, reemplazando cualquier pacto previo, verbal o escrito. Las partes reconocen su
        plena vigencia.
      </li>
    </ol>

    <div class="signature-block">
      <div class="signature">
        <p>
          <strong>{{legalRepresentative}}</strong>
        </p>
        <p>C.C. {{representativeId}}</p>
        <p>Representante Legal de MOTOFACIL DEL ATLANTICO</p>
        <p>
          <strong>ARRENDADOR</strong>
        </p>
      </div>

      <div class="signature">
        <p>
          <strong>{{customerName}}</strong>
        </p>
        <p>C.C. {{customerId}}</p>
        <p>PLACA: {{plate}}</p>
        <p>
          <strong>ARRENDATARIO</strong>
        </p>
      </div>
    </div>

    <div class="footer">
      <p>MOTOFACIL DEL ATLANTICO - Documento generado el {{date}}</p>
    </div>
  </div>
</body>
</html>
`;