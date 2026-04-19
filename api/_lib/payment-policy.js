export const DIRECT_SETTLEMENT_PAYMENT_STATUS = 'direct_settlement'
export const PAYMENT_PENDING_STATUS = 'payment_pending'

export function isCdutServiceCategory(category) {
  return String(category || '').trim().startsWith('cdut/')
}

export function paymentStatusForService(service) {
  return isCdutServiceCategory(service?.category) ? DIRECT_SETTLEMENT_PAYMENT_STATUS : PAYMENT_PENDING_STATUS
}

export function paymentPolicyForService(service) {
  if (isCdutServiceCategory(service?.category)) {
    return {
      mode: 'direct_settlement',
      escrowRequired: false,
      paymentStatus: DIRECT_SETTLEMENT_PAYMENT_STATUS,
      label: '买卖家自行协商结算',
      message: directSettlementMessage(),
    }
  }

  return {
    mode: 'platform_escrow',
    escrowRequired: true,
    paymentStatus: PAYMENT_PENDING_STATUS,
    label: '平台托管付款',
    message: '普通数字服务订单需要走 WhiteHive 平台托管付款。',
  }
}

export function directSettlementMessage() {
  return 'CDUT 专区暂不走平台资金托管，请买卖家在订单聊天中自行协商结算方式，并保留站内沟通记录。'
}
