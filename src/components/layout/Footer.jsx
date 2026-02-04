import { Link } from 'wouter'

export function Footer() {
  return (
    <footer className="bg-muted/50 border-t border-border py-10">
      
       
        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Sistema Licitação. Todos os direitos reservados.</p>
        </div>
      
    </footer>
  )
}


