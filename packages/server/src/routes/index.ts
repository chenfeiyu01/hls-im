import express from 'express'

const router = express.Router()

// 测试路由
router.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

export default router 