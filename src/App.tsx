

import { Outlet } from "react-router-dom";
import NavBar from "@/components/navbar";

import ParticlesBg from 'particles-bg'
import Background1 from '@/components/background1'

import { Button } from "@/components/ui/button"

import {
  ChevronUpIcon
} from "@radix-ui/react-icons"

function App( { children } : { children?: React.ReactNode }) {
  const config = {
    num: [1, 7],
    rps: 0.7,
    radius: [1, 9],
    life: [1, 7],
    v: [0, 0],
    tha: [-10, 10],
    // body: "./img/icon.png", // Whether to render pictures
    // rotate: [0, 20],
    alpha: [0.3, 0],
    scale: [1, 0.1],
    position: "all", // all or center or {x:1,y:1,width:100,height:100}
    color: ["#CCFFDD"],
    cross: "dead", // cross or bround
    random: 3,  // or null,
    g: 0,    // gravity
    // f: [2, -1], // force
    onParticleUpdate: (ctx: any, particle: any) => {
        ctx.arc(particle.p.x, particle.p.y, particle.radius, 2 * Math.PI, false);
        ctx.fillStyle = particle.color;
        ctx.fill();
        ctx.closePath();
    }
  };


  console.log('App.tsx', document.body.clientHeight, window.innerHeight )

  return (
    <div style={{
      position: 'relative',
      height: '100%',
      width: '100%',
      padding: '0',
      margin: '0',
      minHeight: '100vh', // '100%
    }}>
      <div style={{
        width: '100%',
        height: '50px',
        position: 'fixed',
        zIndex: 3,
      }}>
        <NavBar />
      </div>

      <div className="main" style={{
        position: 'relative',
        width: '100%',
        paddingTop: '50px',
        paddingBottom: '50px',
        margin: '0',
        boxSizing: 'border-box',
  
      }}>
        { children ?? <Outlet /> }
      </div>

      <div className="footer" style={{
        height: '50px',
        width: '100%',
        padding: '0 6vw'

      }}>
        <div style={{
          display: document.body.clientHeight > window.innerHeight ? 'block' : 'none',
        }}><Button variant="link" onClick={() =>{ 
          window.scrollTo({ 
            top: 0,  
            behavior: 'smooth'
            /* you can also use 'auto' behaviour 
              in place of 'smooth' */
          }); 
        }} className='text-popover-foreground'>
        <ChevronUpIcon /> scroll to top</Button></div>
      </div>
      <ParticlesBg type="cobweb" bg={true} config={config} color="#99FFCC" />
      <Background1 />
    </div>
  )
}

export default App
