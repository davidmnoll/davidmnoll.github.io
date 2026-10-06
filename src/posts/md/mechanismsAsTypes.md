---
title: "Mechanisms as a programming language"
summary: "How to "
image: "/blog-images/pexels-padrinan-3785929.jpg"
date: "2026-8-17"
draft: true
---

While watching [this](https://youtu.be/ujEZUFNgf50?si=4P5t6LLY9HJOE3M6) Henry Segerman video, I began reading further about overconstrained mechanisms, the Chebychev–Grübler–Kutzbach criterion, and how degrees of freedom affact mobility.  This caused some concepts to click for me relating computer science and type theory to mechanisms. 

Long story short, mechanisms are all about degrees of freedom, constraints, and the way those constraints and degrees of freedom interact.  Type theory may well be the most suitable mathematical language to describe those kinds of dynamics.  However, mechanisms are deeply entrenched in time and space and continuous dimensions, whereas types generally deal with discrete systems, so there is some work involved in unifying them.  

Certainly this connection is well explored in the veins of discrete babbage-style mechanical computers, analog computers, and the theory surrounding both.  But it's an interesting exercise to try to describe mechanisms in terms of a programming language and it can push deep into several territories which I believe deserve more attention.    

First, let's start with some very simple systems to get our bearings.  For the sake of the pun, we can start with an axle and let's assume ball bearings holding it in place.  Intuitively it's clear that we probably want 2 ball bearings rather than just 1 to support the shaft if it its long at all, so that it doesn't cause a torque on the bearing itself.  

In this system we have 1 or potentially 2 significant inputs: the torque we put into the shaft on its long axis, and the translation force we apply parallel to that axis.  Acc

We can certainly cause many other inputs to the system.  According to the [Chebychev–Grübler–Kutzbach criterion](https://en.wikipedia.org/wiki/Chebychev%E2%80%93Gr%C3%BCbler%E2%80%93Kutzbach_criterion) we start with 3 translational and 3 rotational degrees of freedom of each object relative to one another.  We can apply a force perpendicular to the long axis of the shaft, but since we've added the 2nd bearing, this is unlikely to cause an effect on the shaft unless it's a large enough force.  We can raise the temperature of one side of the rod.  However, for the purposes of a simpler model we can try to ignore some of these factors.  

Now let's think about couplings.  This is how mechanisms compose with each other.  We know that couplings tend to require the objects on either side to be located in a certain spot.  Gears which aren't enmeshed don't transmit force.  There are many details to this we can 

It's not immediately obvious how the bearings are supposed to interact with the axle.  We do know it constrains some of its degrees of freedom.  If we assume that the axle's long axis is aligned to the z axis, we remove x and  y translation and rotation.  





One thing I find interesting is the fact that you computation can be done on different substrates.  Original computers were mechanical.  The earliest mechanisms we know of which can be seen as having what most would recognize as computational properies would probably be the antikythera mechanism and automata.  

What exactly is it that causes a mechanism to be seen as doing computation?  There are simple machines like levers and pulleys which we would not generally regard as doing computation.  There are also more complex mechanisms like differential gears.  But the complexity of the mechanism doesn't by itself seem to determine 

Another interesting thing is the idea of a language of mechanisms.  We could potentially use unificaiton to automatically search mechanism space to convey force in a certain way.  This is similar to constraint solving that already exists, but could have a more generalizable semantics. 