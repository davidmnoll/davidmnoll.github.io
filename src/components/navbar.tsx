import { NavLink } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  // SheetDescription,
  // SheetOverlay,
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


import resumeUrl from '@/../assets/pdf/DavidNoll-Resume.pdf'

import {
  EnvelopeClosedIcon,
  FileTextIcon,
  PersonIcon,
  MagicWandIcon,
  HomeIcon
} from '@radix-ui/react-icons'


export default function NavBar() {

  const classFunc = ({ isActive, isPending }: {isActive: boolean, isPending: boolean}) =>
    isActive
      ? "active"
      : isPending
      ? "pending"
      : ""

  return (
    <div style={{
      padding: '5px 6vw',
      position: 'relative'
    }}>
      <Sheet >
        <SheetTrigger asChild>
          <Button variant="ghost" className="hover:bg-whispyblue/5" ><><HamburgerMenuIcon /> &nbsp; Menu</></Button> 
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px] bg-gradient-radial from-green-400/5 via-cyan-900/5 to-blue-500/10 border-whispyblue/10">
          <SheetHeader>
            <SheetTitle>Where to?</SheetTitle>
          </SheetHeader>
          <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            boxSizing: 'border-box',
            paddingBottom: "2rem",
            height: "100%",
          }}>
          <p>
            <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <NavLink to="/" reloadDocument className={classFunc} >Home <HomeIcon className="inline" /></NavLink>
            </Button>
          </p>
          <p>
            <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <a className={`text-popover-foreground inline-block drop-shadow-lg`} href="mailto:david.m.noll@gmail.com"> Mail <EnvelopeClosedIcon className='inline' /></a>
            </Button>
          </p>
          <p>
            <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <a className={`text-popover-foreground inline-block drop-shadow-lg`} href={resumeUrl}> Resume <FileTextIcon className='inline' /></a>
            </Button>
          </p>
          <p>
            <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <NavLink to="/skills" reloadDocument className={classFunc} >Skills <MagicWandIcon className="inline" /></NavLink>
            </Button>
          </p>
          <p>
            <Button variant="ghost" className="hover:bg-whispyblue/5" >
              <NavLink to="/about" reloadDocument className={classFunc} >About <PersonIcon className="inline" /></NavLink>
            </Button>
          </p>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  )
  
}