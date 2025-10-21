import originalAxios from 'axios'

export const axios = originalAxios.create({
  timeout: 10000,
})
