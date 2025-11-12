import bs58 from 'bs58';
import crypto from 'crypto';

export interface TokenValidationResult {
  payload: Buffer;
  payloadHash: Buffer;
}

const PAYLOAD_LENGTH = 16;
const CHECKSUM_LENGTH = 4;
const TOKEN_LENGTH = PAYLOAD_LENGTH + CHECKSUM_LENGTH;

export class TokenValidationError extends Error {}

export function validateAndParseToken(token: string): TokenValidationResult {
  let decoded: Buffer;

  try {
    decoded = Buffer.from(bs58.decode(token));
  } catch (error) {
    throw new TokenValidationError('Failed to decode token');
  }

  if (decoded.length !== TOKEN_LENGTH) {
    throw new TokenValidationError('Unexpected token length');
  }

  const payload = decoded.subarray(0, PAYLOAD_LENGTH);
  const checksum = decoded.subarray(PAYLOAD_LENGTH);
  const expectedChecksum = doubleSha256(payload).subarray(0, CHECKSUM_LENGTH);

  if (!checksum.equals(expectedChecksum)) {
    throw new TokenValidationError('Checksum mismatch');
  }

  const payloadHash = sha256(payload);
  return { payload, payloadHash };
}

function sha256(buffer: Buffer): Buffer {
  return crypto.createHash('sha256').update(buffer).digest();
}

function doubleSha256(buffer: Buffer): Buffer {
  return sha256(sha256(buffer));
}
