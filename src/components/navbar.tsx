import { NavLink } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetOverlay,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Button,
} from "@/components/ui/button"
import {
  HamburgerMenuIcon
} from "@radix-ui/react-icons"

export default function NavBar() {

  const classFunc = ({ isActive, isPending }: {isActive: boolean, isPending: boolean}) =>
    isActive
      ? "active"
      : isPending
      ? "pending"
      : ""

  return (
    <div style={{
      padding: '5px 6vw'
    }}>
      <Sheet >
        <SheetTrigger asChild>
          <Button variant="ghost" className="hover:bg-whispyblue/5" ><><HamburgerMenuIcon /> &nbsp; Menu</></Button> 
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px] bg-gradient-radial from-green-400/5 via-cyan-900/5 to-blue-500/10">
          <SheetHeader>
            <SheetTitle>Where to?</SheetTitle>
          </SheetHeader>
          <p>
            <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <NavLink to="/" reloadDocument className={classFunc} >Home</NavLink>
            </Button>
          </p>
          <p>
            <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <NavLink to="/contact" reloadDocument className={classFunc} >Contact</NavLink>
            </Button>
          </p>
          <p>
            <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <NavLink to="/resume" reloadDocument className={classFunc} >Resume</NavLink>
            </Button>
          </p>
          <p>
            <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <NavLink to="/work" reloadDocument className={classFunc} >Work</NavLink>
            </Button>
          </p>
          <p>
            <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <NavLink to="/about" reloadDocument className={classFunc} >About</NavLink>
            </Button>
          </p>
        </SheetContent>
      </Sheet>

    </div>
  )
  
}