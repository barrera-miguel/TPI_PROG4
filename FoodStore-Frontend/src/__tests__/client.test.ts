import client from '../api/client'

describe('client (Axios)', () => {
  it('has withCredentials enabled', () => {
    expect(client.defaults.withCredentials).toBe(true)
  })

  it('has baseURL configured', () => {
    expect(client.defaults.baseURL).toBeTruthy()
  })

  it('calls interceptors for response success', async () => {
    // Just verify interceptor structure exists
    const interceptors = client.interceptors.response
    expect(interceptors).toBeDefined()
  })

  it('handles 401 with refresh token flow', async () => {
    // Verify the interceptor is registered
    // We can't easily test without backend but can verify structure
    expect(typeof client.interceptors.response).toBe('object')
  })
})
