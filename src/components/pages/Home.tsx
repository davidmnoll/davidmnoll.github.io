// import React, { useEffect, useRef } from 'react'

import Section from '../section'

// import Contact from "@/components/sections/Contact"
import About from "@/components/sections/About"
// import Work from "@/components/sections/Work"
// import Skills from "@/components/sections/Skills"

export default function Home({ position }: {position: string}) {
    
  console.log(position)

  return (
    <div  className="grid grid-cols-1 lg:grid-cols-1" style={{
      width: '100%',
      padding: '0 3vw',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* <Section position="contact" current={position}>
        <Contact />
      </Section> */}
      <Section position="about" current={position}>
        <About />
      </Section>
      {/* <Section position="skills" current={position}>
        <Skills />
      </Section> */}
      {/* <Section position="work" current={position}>
        <Work />
      </Section> */}

    </div>
  )
}

