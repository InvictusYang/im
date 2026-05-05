import { useState } from 'react'
import api from '../utils/api'

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login'
      const res = await api.post(endpoint, formData)
      
      onLogin(res.data.user, res.data.token)
    } catch (err) {
      setError(err.response?.data?.error || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>P2PChat</h1>
        <p className="subtitle">轻量级即时通讯系统</p>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label>显示名称</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={e => setFormData({...formData, displayName: e.target.value})}
                placeholder="可选"
              />
            </div>
          )}

          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
              placeholder="请输入用户名"
              required
              minLength={3}
              maxLength={20}
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              placeholder="请输入密码"
              required
              minLength={6}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '处理中...' : (isRegister ? '注册' : '登录')}
          </button>
        </form>

        <div className="toggle-mode">
          {isRegister ? (
            <p>已有账号？<a onClick={() => setIsRegister(false)}>登录</a></p>
          ) : (
            <p>没有账号？<a onClick={() => setIsRegister(true)}>注册</a></p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
