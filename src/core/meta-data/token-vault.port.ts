export interface TokenVaultPort {
  encrypt(plaintext: string): string
  decrypt(ciphertext: string): string
}
