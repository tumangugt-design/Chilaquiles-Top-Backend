import * as financeService from './finances.service.js'

export const getSummary = async (req, res) => {
  try {
    const summary = await financeService.getFinancialSummary()
    res.status(200).json({ success: true, data: summary })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
