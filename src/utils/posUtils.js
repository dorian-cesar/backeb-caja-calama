const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;
const SEPARATOR = '|';

// Códigos intermedios del POS
const INTERMEDIATE_STATUS_CODES = {
  '81': 'Solicitando ingreso de clave',
  '82': 'Enviando transacción al autorizador',
  '83': 'Selección menú crédito/Redcompra',
  '84': 'Opere tarjeta',
  '85': 'Selección de cuotas',
  '86': 'Ingreso de cuotas',
  '87': 'Confirmación de cuotas',
  '88': 'Aceptar consulta cuotas',
  '93': 'Consultando cuota al autorizador'
};

function calculateLRC(data) {
  let lrc = 0;
  for (let i = 0; i < data.length; i++) {
    lrc ^= data.charCodeAt(i);
  }
  return String.fromCharCode(lrc);
}

function buildMessage(command, fields) {
  const data = [command, ...fields].join(SEPARATOR);
  const message = String.fromCharCode(STX) + data + String.fromCharCode(ETX);
  return message + calculateLRC(data + String.fromCharCode(ETX));
}

function parseResponse(response) {
  if (!response || typeof response !== 'string' || response.length < 5) {
    throw new Error('Respuesta inválida del POS');
  }

  // Manejo de mensajes intermedios (0900)
  const intermediatePrefix = String.fromCharCode(STX) + '0900';
  if (response.startsWith(intermediatePrefix)) {
    const parts = response.split(SEPARATOR);
    return {
      command: '0900',
      responseCode: parts[1],
      statusMessage: INTERMEDIATE_STATUS_CODES[parts[1]] || 'Estado desconocido',
      rawResponse: response
    };
  }

  // Verificar STX al inicio y LRC al final
  if (response.charCodeAt(0) !== STX) {
    throw new Error('Formato de respuesta incorrecto - Falta STX');
  }

  const receivedLRC = response.charCodeAt(response.length - 1);
  const messageWithoutLRC = response.substring(0, response.length - 1);
  const calculatedLRC = calculateLRC(messageWithoutLRC.substring(1)); // Excluye STX

  if (receivedLRC !== calculatedLRC.charCodeAt(0)) {
    throw new Error('Error de integridad (LRC no coincide)');
  }

  const messageContent = messageWithoutLRC.substring(1); // Remover STX
  const etxPos = messageContent.indexOf(String.fromCharCode(ETX));
  if (etxPos === -1) {
    throw new Error('Formato de respuesta incorrecto - Falta ETX');
  }

  const dataPart = messageContent.substring(0, etxPos);
  const fields = dataPart.split(SEPARATOR);

  return {
    command: fields[0],
    responseCode: fields[1],
    commerceCode: fields[2],
    terminalId: fields[3],
    ticketNumber: fields[4],
    authorizationCode: fields[5],
    amount: fields[6],
    last4Digits: fields[7],
    operationNumber: fields[8],
    cardType: fields[9],
    rawResponse: response
  };
}

function validateACKNAK(response) {
  if (!response) return false;
  const code = response.charCodeAt(0);
  return code === ACK || code === NAK;
}

module.exports = {
  INTERMEDIATE_STATUS_CODES,
  calculateLRC,
  buildMessage,
  parseResponse,
  validateACKNAK,
  constants: {
    STX,
    ETX,
    ACK,
    NAK,
    SEPARATOR
  }
};
