import { useEffect, useRef } from "react"


const Section = ({ position, children, current } : { current: string, position: string, children?: React.ReactNode }) => {

  console.log(current, position, current === position)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if(current === position){
      console.log('current === position', current, position)
      ref.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])
  
  return (
    <div  className="section" ref={ref} style={{
      // 'backgroundImage': 'radial-gradient(circle, rgba(2,0,36,.05) 0%, rgba(71,71,147,0.1) 31%, rgba(0,212,255,0.05) 100%)',
      'backgroundImage': 'radial-gradient(circle, rgba(247,50,50,.05) 0%, rgba(245,100,50,0.1) 31%, rgba(230,203,11,0.05)',
      'padding': '3vw',
      'minHeight': '300px',
      'width': 'calc(100% - 6vw)',
      'boxSizing': 'border-box',
      'borderRadius': '10px',
      'position': 'relative',
      'margin': '3vh auto',
    }}>
      {current === position 
        ? <h1>Section: {position} </h1>
        : <h3>Section: {position} </h3>
      }
      {children}
    </div>
  )
}

export default Section