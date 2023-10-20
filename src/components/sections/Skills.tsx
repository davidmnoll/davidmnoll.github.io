import React, { useEffect, useRef } from 'react'

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import Section from '../section'

import { buttonVariants } from "@/components/ui/button"

import {
  EnvelopeClosedIcon
} from '@radix-ui/react-icons'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
 

 
type SliderProps = React.ComponentProps<typeof Slider>
 
export function SliderDemo({ className, ...props }: SliderProps) {
  return (
    <Slider
      defaultValue={[50]}
      max={100}
      step={1}
      className={cn("w-[60%]", className)}
      {...props}
    />
  )
}


export default function Skills() {


  return (
    <div   style={{
      width: '100%',
      boxSizing: 'border-box',
      height: "100%",
    }}>
      <div style={{
        fontSize: '1.2rem',
        fontWeight: 'bold',
      }}>Skills</div>

    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      boxSizing: 'border-box',
      paddingBottom: "2rem",
      height: "100%",
    }}>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1" className="border-whispyblue/10">
          <AccordionTrigger>Backend</AccordionTrigger>
          <AccordionContent>
            <div style={{
              padding: '1rem 0',
            }}>
              <Skill name="NodeJS/Typescript" value={90} />
              <Skill name="Express" value={70} />
              <Skill name="Python" value={80} />
              <Skill name="Django" value={80} />
              <Skill name="Flask" value={80} />
              <Skill name="Java" value={50} />
              <Skill name="Rust" value={30} />
              <Skill name="Haskell" value={30} />
              <Skill name="Scala" value={40} />
              <Skill name="PHP" value={80} />
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2" className="border-whispyblue/10">
          <AccordionTrigger>Front End</AccordionTrigger>
          <AccordionContent>
            <div style={{
              padding: '1rem 0',
            }}>
              <Skill name="React" value={90} />
              <Skill name="NextJs" value={70} />
              <Skill name="SolidJs" value={40} />
              <Skill name="Canvas / Animation" value={60} />
              <Skill name="Vue" value={50} />
              <Skill name="Visual Design" value={40} />
              <Skill name="WASM" value={80} />

            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3" className="border-whispyblue/10">
          <AccordionTrigger>Database / ORM</AccordionTrigger>
          <AccordionContent>
            <div style={{
                padding: '1rem 0',
              }}>
              <Skill name="MySQL" value={80} />
              <Skill name="PostgreSQL" value={85} />
              <Skill name="Redis" value={40} />
              <Skill name="Mongo" value={40} />
              <Skill name="SQL Alchemy" value={70} />
              <Skill name="Prisma" value={80} />

            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-4" className="border-whispyblue/10">
          <AccordionTrigger>Devops / Infrastructure</AccordionTrigger>
          <AccordionContent>
            <div style={{
                padding: '1rem 0',
              }}>
              <Skill name="AWS" value={70} />
              <Skill name="Azure" value={60} />
              <Skill name="Linux (Ubuntu)" value={80} />
              <Skill name="Docker" value={80} />
              <Skill name="Kubernetes" value={30} />
              <Skill name="Terraform" value={30} />
              <Skill name="Github Actns, Gitlab CI/CD" value={80} />
              <Skill name="Cypress" value={90} />
              <Skill name="Heroku" value={80} />
              <Skill name="Apache" value={80} />
              <Skill name="Nginx" value={80} />
              <Skill name="IIS" value={60} />
              <Skill name="Heroku" value={80} />


            </div>
          </AccordionContent>
        </AccordionItem>      
        <AccordionItem value="item-5" className="border-whispyblue/10">
          <AccordionTrigger>Soft</AccordionTrigger>
          <AccordionContent>
            <div style={{
                padding: '1rem 0',
              }}>
              <Skill name="R&D" value={80} />
              <Skill name="Testing" value={70} />
              <Skill name="Troubleshooting" value={90} />
              <Skill name="Design/Architecture" value={70} />
              <Skill name="Project Management" value={70} />
              <Skill name="Mentorship" value={80} />
            </div>
          </AccordionContent>
        </AccordionItem>      

        <AccordionItem value="item-6" className="border-whispyblue/10">
          <AccordionTrigger>Domain Specific</AccordionTrigger>
          <AccordionContent>
            <div style={{
                padding: '1rem 0',
              }}>
              <Skill name="Audio/Video" value={40} />
              <Skill name="Blender" value={50} />
              <Skill name="Ethereum Ecosystem" value={60} />
              <Skill name="Android" value={50} />
              <Skill name="Security" value={80} />
            </div>
          </AccordionContent>
        </AccordionItem>      

        <AccordionItem value="item-7" className="border-whispyblue/10">
          <AccordionTrigger>Interests</AccordionTrigger>
          <AccordionContent>
            <div style={{
                padding: '1rem 0',
              }}>
              <Skill name="Machine Learning" value={30} />
              <Skill name="Programming Languages" value={30} />
              <Skill name="Blockchain" value={60} />
              <Skill name="Decentralized Architecture" value={50} />
              <Skill name="Distributed Systems" value={10} />
            </div>
          </AccordionContent>
        </AccordionItem>    
      </Accordion>

    </div>

    </div>
  )
}


const Skill = ({name, value}: {name: string, value: number}) => {

  return <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 2fr",
      padding: '.5rem 5vw'
    }}>
    <div style={{
    }}>
      {name}
    </div>
    <div style={{
    }}>
      <Slider
        defaultValue={[80]}
        value={[value]}
        max={100}
        step={1}
        disabled={true}
        className={"w-[100%]"}
      />
    </div>
  </div>

}
