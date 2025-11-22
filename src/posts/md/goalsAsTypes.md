---
title: "Propositions as sessions as facts as goals as types"
summary: "How workflows, logic programming, process calculi, and theorem proving collide"
image: "/blog-images/goalsAsTypes.png"
date: "2025-10-28"
---

The famous Curry Howard correpsondence has spawned [copycat correspondences](https://homepages.inf.ed.ac.uk/wadler/papers/propositions-as-sessions/propositions-as-sessions.pdf).  Let's make another one. 

<details>
<summary> First let's understand what types are.  We can consider types as term graphs with their branches lopped off.  </summary>

The most straightforward way to understand types is by using the term graph model of computation.  This considers computations as a tree of expressions which get rewritten.  Variables determine the wiring of the terms.  A type in this context can be modeled as a set of patterns (constructed of the same atomic units as the term graph) which may or may not match up to a subgraph.  In other words at the node of the term graph that we want to check against a certain type, we check whether the value has a matching constructor for the type at each relevant branch.  When the entire subtree is specified, the type is precisely the value.
</details>

<details>
<summary>Looking through this lens, we can consider effects to be subgraphs inserted during runtime</summary>
These subgraphs are values that may be inserted by arbitrary input, random generation, or retrieval from a file or network call.  Even state which is considred effectful in Haskell would be copying a subgraph from one part of a program's context to another. 
</details>

<details>
<summary> Let's consider how a traditional type system fits into Datalog</summary>

Recall Datalog's basic semantics.  You can define "facts" and "rules".  And then you can run a query, which will use some kind of unification or constraint solving which determines if you can derive the appropriate value from the given facts and rules.  These are wired up by variable names.   ### You can intuitively model this by saying that dependency graph is created where you start with facts, rules are then applied to each set of facts to create a larger set of facts, some of which are compound.  In the end you have a dependency DAG where the same rule can create a new fact depending on which facts it's depending on.  So the variables in the rule statements determine the wiring of the graph ###  

This kind of programming is disorienting at first, and the reason is because you're essentially thinking at the type level without necessarily realizing it.  

We can identify that the query semantics are doing something like pattern matching.  According to our previous description of types, that would mean we're querying via type.  That only works if the type is adequately constrained.  In datalog this works no matter what because the only values that can inhabit types are values which have been defined in the scope, so the output is inherently constrained to a finite number of values.  

As expected this fits nicely with the idea that "propositions" are "types".  The query is a proposition or type, and the result the equivalent of a combo of type check + find inhabitants in current scope. 
</details>

<details>
<summary> Next we can look at process calculi and their correspondence to types via sessions</summary>
For a process calculus at first glance it is probably harder to find the connection.  However we just have to find the dependency graph.  This is found in the sequence of calls between actors.  When A sends a message to B over a certain channel, this means B is listening for that message, which establishes the dependency.  So the channels are responsible for wiring up the graph.  When we then look at the idea of holes in that dependency graph which can be filled by many different continuations, we can imagine a truncated back and forth which could continue in one of a set of ways.  So we have a set sequence of interactions which establishes within A and B a shared context to be continued in one of many ways... this is essentially the description of a protocol.  Sessions are a particular way to type those protocols which allows agents A and B enough guarantees to type check the processes.  The arbitrary names of channels correspond to the arbitrary names of variables -- they provide a way to wire chunks of immutable logic together.  
</details>


<details>
<summary> In the context of the workflow / task world, goals are types</summary>

With tasks the dependency graph is clear.  Subtasks complete tasks and hopefully update state which allows larger tasks to be marked as completed. 

But what does this look like when we consider holes in the dependency graph?  We end up with a dependency graph which can be completed with any one of many different subroutines.  But this is every task.  There's more than 1 way to skin any cat.  This would mean that any task is a type.  Then what would that make the actual values?  Well, they would be the actual details of how the task got done.  

If we step back to considering types as sets and map a correspondence to the sets versus members of a set, we see that goals or tasks are sets.  The type can be satisfied in any number of ways.  If the task is a hole, then completing it means filling that hole.

This makes sense because in the real world, a task is generally awaiting some input.  If you have a subtask, it's because the larger task needs some input.  For instace "build a house" will have somewhere a subtask of "buy lumber" because that gets input into the final product.  In a program, the task may be awaiting input like a name, a choice, or a completion status.  That output of the subtask later becomes an input of the parent task.  It becomes a value that fills the parent's hole.  

Here's a paper illustrating that tasks can be composed with all-of, one-of, or sequential compostion.  This mirrors the Promise.all, Promise.any, and Promise.then which we find in Javascript.  In types these very naturally correspond to the sum type, product type, and typeclasses. 


So a workflow that has some certain kind of input requirement would be a typeclass.  ??


One critical aspect of the term graph that we've been glossing over this whole time is what happens as you're traversnig it.  You're rewriting subgraphs.  

</details>

<details>
<summary>This brings us to another point which is that coroutines also fall into this mix.</summary>

 Tasks and workflows are most naturally suited to be modeled as coroutines which indicates that coroutines themselves can be modeled in a similar way with respect to the type correspondence.  Now how are these coroutines supposed to send signals back and forth to each other? 

That brings us to another correspondence - the process / session correspondence.  A typed coroutine with message passing between the routines is equivalent to a session type.

So we can see that Tasks -> Workflows (compositions of tasks) -> Coroutines -> Process Calculi.  Now let's step back and flesh out the correspondence between process calculi and tasks.  

A task/workflow may involve multiple actors/"processors".  These entities must pass signals back and forth to each other in some form or another.  The same can be said for algebraic effects, which are essentially a form of cooroutine.  A coroutine yielding is the equivalent of sending a response message.  A coroutine being called with next (or whatever triggers execution) is a message being passed the other way.  Both sides are essentially process servers which must establish some shared channel(s) to communicate the arguments.  Type checking across the channel(s) to ensure an appropriate combination of message types gives you the join calculus. 

So a task is an initialized variable with a type, but which does not have 

What this means is that each task can be treated as a protocol or session type.  Some of these 

Each coroutine would then correspond to an actor/agent in a process calculus.  


</details>

<details>
<summary>This means we can model asynchronous programming through a similar lens</summary>

The asynchronous program is expressing a type and an effect is 

</details>

<details>
<summary>Linear types can then map back to all these domains in interesting ways.</summary>

</details>

<details>
<summary>And yet the holy grail would be Homotopy Types, which provide extremely powerful capabilities in the world of tasks as types.</summary>

</details>




