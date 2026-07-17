export function hasSelectedMetaAccount(input: {
  businessId: string
  accounts: Array<{ businessId: string | null; isSelected: boolean }>
}): boolean {
  return input.accounts.some(
    (account) => account.isSelected === true && account.businessId === input.businessId,
  )
}
