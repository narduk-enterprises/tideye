import { useSignalK } from '~/composables/useSignalK'

export default defineNuxtPlugin(() => {
  const { bootstrap } = useSignalK()
  bootstrap()
})
