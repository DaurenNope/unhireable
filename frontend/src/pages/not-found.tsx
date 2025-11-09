import { Button } from "../components/ui/button"
import { useNavigate } from "react-router-dom"

export function NotFound() {
  const navigate = useNavigate()
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <h2 className="mt-4 text-2xl font-semibold">Page Not Found</h2>
      <p className="mt-2 text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button 
        onClick={() => navigate(-1)} 
        className="mt-6"
      >
        Go Back
      </Button>
    </div>
  )
}
