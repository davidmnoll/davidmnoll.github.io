
import { useRef, useState, useEffect } from 'react'   

import { useIsScrolling } from '@/components/use-scroll'

const Background2 = () => {
  //http://creativejs.com/2011/12/day-3-play-with-your-pixels/

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [iteration, setIteration] = useState(0);
    

  const {
    isScrolling
  } = useIsScrolling();
    
  useEffect(() => {
    console.log('isScrolling', isScrolling)
    if (isScrolling){
      setIteration(0)
    }
  }, [isScrolling])


  useEffect(() => {

    const numIterations = 21
    // console.log('iteration', iteration, numIterations)

    if (iteration < 0){
      return 
    }

    if (iteration > numIterations ){
      // setIteration(-1)
      return
    }


    if (!canvasRef.current) {
      throw new Error('no canvas')
    }
    const context = canvasRef.current.getContext('2d', { willReadFrequently: true })

    if (!context) {
      throw new Error('no context')
    }

    const imagedata = context?.getImageData(0, 0, canvasRef.current?.width, canvasRef.current.height);

    if (!imagedata) {
      throw new Error('no imagedata')
    }

    if (iteration >= numIterations){
      context.clearRect(0, 0, imagedata.width, imagedata.height);
      context.beginPath();
      context.fillStyle = "rgba(0, 0, 0, 0)";
      context.fillRect(0, 0, imagedata.width, imagedata.height);
    }

    const setPixel = (imagedata: ImageData, x: number, y: number, r: number, g: number, b: number, a: number) => {
      let i = (y * imagedata.width + x) * 4;
      imagedata.data[i++] = r;
      imagedata.data[i++] = g;
      imagedata.data[i++] = b;
      imagedata.data[i] = a;
    }
    

    for( let y = 0 ; y < imagedata.height; y++ ) {
      for( let x = 0 ; x < imagedata.width; x++ ) {
        // set the colour randomly
        // const heightFrac = 10;
        // const yScrollFraction = 1
        if(Math.random() * 700  < 1){
        // if(true){
          setPixel(imagedata, x, y, 
              Math.floor((Math.random() * 155 ) + 100 ), 
              Math.floor((Math.random() * 55)  ),
              Math.floor((Math.random() * 100) )  , 
              Math.floor((Math.random() * 55) + 200)
            );
        } else {
          setPixel(imagedata, x, y, 0, 0, 0 , 0);
        }
      }
    }
    context.putImageData(imagedata, 0, 0);
    const nextInterval =  (Math.tanh(iteration / numIterations) * 300 )
    // console.log('nextInterval', nextInterval)
    setTimeout(() => setIteration(iteration + 1), nextInterval)
    return () => {  }
  }, [iteration])


  

  return <canvas ref={canvasRef} id="canvas" width={Math.floor(window.innerWidth / 54)} height="300" style={{
    'position': 'absolute',
    'top': '0',
    'left': '0',
    'zIndex': '-2',
    'opacity': '1',
    'backgroundColor': 'transparent',
    'width': "100%",
    'height': "100%",
  }}></canvas>

}



export default Background2