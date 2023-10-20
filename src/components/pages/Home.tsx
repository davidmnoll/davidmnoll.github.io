import React, { useEffect, useRef } from 'react'

import Section from '../section'

export default function Home({ position }: {position: string}) {
    
  console.log(position)

  return (
    <div  className="grid grid-cols-1 lg:grid-cols-2" style={{
      width: '100%',
      padding: '0 3vw',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      <Section position="contact" current={position}>
        test
      </Section>
      <Section position="skills" current={position}>
        test
      </Section>
      <Section position="work" current={position}>
        test
      </Section>
      <Section position="about" current={position}>
        test
      </Section>
    </div>
  )
}

