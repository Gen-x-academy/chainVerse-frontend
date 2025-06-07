import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export default function AuthPrompt() {
  const router = useRouter()
  const { requiresAuth, setRequiresAuth } = useCartStore()

  const handleLogin = () => {
    setRequiresAuth(false)
    router.push('/login')
  }

  return (
    <Dialog open={requiresAuth} onOpenChange={setRequiresAuth}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Authentication Required</DialogTitle>
          <DialogDescription>
            Please log in or create an account to add items to your cart and make purchases.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-4 justify-end mt-4">
          <Button variant="outline" onClick={() => setRequiresAuth(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleLogin}>
            Login
          </Button>
          
        </div>
      </DialogContent>
    </Dialog>
  )
} 