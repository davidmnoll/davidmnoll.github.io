import React, { useRef, useEffect } from 'react'   

const Background1 = () => {
  //http://creativejs.com/2011/12/day-3-play-with-your-pixels/

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if(canvasRef.current){
      animateCanvas(canvasRef.current)
    }
  }, [])
 

  return <canvas ref={canvasRef} id="canvas" width="500" height="3" style={{
    'position': 'absolute',
    'top': '0',
    'left': '0',
    'zIndex': '-1',
    'opacity': '.7',
    'backgroundColor': '#333',
    'width': "100%",
    'height': "100%",
  }}></canvas>

}


const animateCanvas = (canvas: HTMLCanvasElement) => {
  var context = canvas.getContext('2d');
  if (!context) {
    return
  }
  var imagedata = context.getImageData(0, 0, canvas.width, canvas.height);

  function getPixel(imagedata: any, x: number, y: number) {
    var i = (y * imagedata.width + x) * 4;

    return {r: imagedata.data[i], g: imagedata.data[i+1], b: imagedata.data[i+2], a: imagedata.data[i+3]};
  }
  function setPixel(imagedata: any, x: number, y: number, r: number, g: number, b: number, a: number) {
    var i = (y * imagedata.width + x) * 4;
    imagedata.data[i++] = r;
    imagedata.data[i++] = g;
    imagedata.data[i++] = b;
    imagedata.data[i] = a;
  }

  function randomate(){
    for( var y = 0 ; y < imagedata.height; y++ ) {
      for( var x = 0 ; x < imagedata.width; x++ ) {
        // set the colour randomly
        setPixel(imagedata, x, y, Math.floor((Math.random() * 0 ) + 35), Math.floor((Math.random() * 5) + 70 ),Math.floor((Math.random() * 1) + 59), Math.floor((Math.random() * 0) + 255));
      }
    }
    context?.putImageData(imagedata, 0, 0);
  }

  setInterval(randomate, 150);

}

export default Background1