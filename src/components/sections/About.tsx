import profileImage from '@/../assets/img/profile.jpeg'
import resumeUrl from '@/../assets/pdf/DavidNoll-Resume.pdf'

import {
  EnvelopeClosedIcon,
  FileTextIcon,
  GitHubLogoIcon,
  LinkedInLogoIcon
} from '@radix-ui/react-icons'


export default function Home() {
    

  return (
    <div   style={{
      width: '100%',
      boxSizing: 'border-box',
    }}>
     {/* <h3 style={{
        gridColumn: "1/3",
      }}>About</h3> */}
      <div className="grid grid-cols-1 md:grid-cols-2">

      <div style={{
          width: '100%',
          maxWidth: '150px',
          margin: '0 auto',
          display: 'block',
          overflow: 'hidden',
      }}>
        <img src={profileImage} style={{
          margin: '0 auto',
          borderRadius: '15%',
          width: '150px',
          height: '150px',
          objectPosition: '0px 0px',
          display: 'block',
          gridColumn: "1",
          objectFit: 'cover',
        }} />
      </div>

      <div className="flex flex-col justify-center">

      <div style={{
        fontSize: '1.2rem',
        fontWeight: 'bold',
        paddingBottom: '1rem',
        textAlign: 'center',
      }}>David M Noll</div> 

<div className='grid grid-cols-2'
        >

        <div style={{
          padding: '.23rem 0 ',
          textAlign: 'center',
          gridColumn: "1",
        }}>
          <span >  <a className={`text-popover-foreground inline-block`} href="mailto:david.m.noll@gmail.com"> Mail: <EnvelopeClosedIcon className='inline' /></a></span>
        </div>
        <div style={{
          padding: '.23rem 0 ',
          textAlign: 'center',
          gridColumn: "2",
        }}>
          <span ><a className={`text-popover-foreground inline-block`} href={resumeUrl}> Resume: <FileTextIcon className='inline' /></a></span>
        </div>

        <div style={{
          padding: '.23rem 0 ',
          textAlign: 'center',
          gridColumn: "1",
        }}>
          <span > <a className={`text-popover-foreground inline-block`} href="https://github.com/davidmnoll" target="_blank">Github: <GitHubLogoIcon className='inline' /></a></span>
        </div>
        <div style={{
          padding: '.23rem 0 ',
          textAlign: 'center',
          gridColumn: "2",
        }}>
          <span > <a className={`text-popover-foreground inline-block`} href="https://www.linkedin.com/in/nolldavid/" target='_blank'>LinkedIn: <LinkedInLogoIcon className='inline' /></a></span>
        </div>
        </div>
        </div>
      </div>
      <p style={{
        gridColumn: "1/3",
        padding: '1rem 0',
        margin: '1rem 0',
        fontSize: '.8rem',
      }}  className="border-whispyblue/10 border-b border-t">
        I am a full stack engineer with experience leading engineering developments in startup environments. 
        <br />
        <br />
        My experience lies mostly in full stack development for web applications.  I have begun documenting some of my learning of other realms of software development <a href="https://davidmnoll.substack.com/" className='underline'>here</a>.
        <br />
        {/* <br />
        I'm interested in learning more about all kinds of subjects including workflows, decentralized systems, functional programming, machine learning, combinator & graph rewriting systems
        <br /> */}
        <br />
        My other academic interests include: information theory, cognitive science, math, physics, history, and statistics.
        <br />
        <br />
        Outside of work, I enjoy spending time with my wife & son, hiking, playing board games, some video games, and trying to get in shape.
        {/* <br />
        Favorite things: Incomplete Nature by Terrence Deacon, Clickspring's Antikythera Mechanism video, Tigris & Euphrates by Reiner Knizia, Paths of Glory by Stanley Kubrick, Four Seasons recomposed by Max Richter,  */}

      </p>

      <div style={{
          margin: '0 auto',
          width: '100%'
        }}>
      <div style={{
        gridColumn: "1/3",
        padding: '1rem 0',
        margin: '1rem 0',
        fontSize: '.8rem',
        // borderTop: '1px solid #333',
        // borderBottom: '1px solid #333',
      }}>
        <span style={{
          gridColumn: "1/3",
          fontSize: '1.2rem',
          fontWeight: 'bold',
          // paddingBottom: '1rem',
          display: 'block',
        }}>Projects</span>
          {/* <br />
          <span style={{
            fontSize: '1rem',
          }}>Fosforescent</span>: (work in progress) a platform & marketplace for collaborative workflows */}
          <br />
          {/* <div style={{
            padding: '.5rem 0',
          }}>
            <span style={{
              fontSize: '1rem',
              display: 'inline-block',
            }}><a href="https://github.com/davidmnoll/netcode">Netcode:</a></span> (work in progress) a neuron-wise neural net library & playground
          </div> */}
          {/* <div style={{
            padding: '.5rem 0',
          }}>
            <span style={{
              fontSize: '1rem',
              display: 'inline-block',
            }}><a href="https://github.com/davidmnoll/pixel-time">PixelTime:</a></span> (work in progress) a web3 project allowing users to collaboratively make a series of images
          </div> */}
          <div style={{
            padding: '.5rem 0',
          }}>
            <span style={{
              // fontSize: '1rem',
              display: 'inline-block',
            }} className="underline"><a href="https://github.com/davidmnoll/pixel-time">Chkflow:</a></span> a React component editor/view for tree data inspired by Workflowy’s interface
          </div>
          <div style={{
            padding: '.5rem 0',
          }}>
            <span style={{
              // fontSize: '1rem',
              display: 'inline-block',
            }} className="underline"><a href="https://github.com/davidmnoll/pixel-time">GLTrader:</a></span> a custom python GUI for trading on the Bittrex exchange
            </div>
          </div>
        </div>
    </div>
  )
}

