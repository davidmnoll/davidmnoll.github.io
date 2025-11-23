---
title: "Neural Nets as types, and everything else, too"
summary: "How neural nets, workflows, logic programming, process calculi, and theorem proving collide"
image: "/blog-images/goalsAsTypes.png"
date: "2025-10-28"
---

The famous Curry Howard correpsondence has spawned [copycat correspondences](https://homepages.inf.ed.ac.uk/wadler/papers/propositions-as-sessions/propositions-as-sessions.pdf).  Let's do it some more. 

<details>
<summary>First let's understand what types are and the original types as propositions correspondence. We can consider types as parts of computations graphs with their branches lopped off.</summary>

Types are most directly associated with sets of values.  However another way to understand types is by looking at the computation graph.  In this graph each node can be considered to represent an expression and the outgoing edges point to the sub-expressions that it depends on.  These are ultimately equivalent.  A set of values is a set of graph shapes.  As long as the sum type is an acceptable graph shape, a set of graph shapes is itself a graph shape.  So I may move back and forth between these conceptions. 

A type in this context can be modeled as a set of patterns (constructed of the same atomic units as the computation graph) which may or may not match up to a subgraph.  In other words at the node of the computation graph that we want to check against a certain type, we check whether the value has a matching constructor for the type at each relevant branch.  When the entire subtree is specified, the type can be inhabited only by a single value--the one with that same subtree.

In a computational approach to logic, a proof must be depend on either assumptions or axioms.  Some axioms provide only initial values.  Other axioms provide "operators" that allow those initial values to be composed into compound statements.  Some of the compound statements can then be reduced again by other axioms.  We can analogize each statement to be an expression, and the simplification of the expression then corresponds to computation. 

In this world, a proposition is a statement that may or may not be true.  Whether it is true depends on whether a graph can be constructed from the primitives and axioms provided.  It may also be proved in more than one way.  In other words it's a dependency graph with branches lopped off that must be compared to the dependency graphs we can inductively construct from our primitives. 

[Here's a paper](http://strictlypositive.org/diff.pdf) illustrating a similar view on the matter.  
</details>



<details>
<summary>If we consider how a traditional type system fits into Datalog, we can understand queries as types.</summary>

Recall Datalog's basic semantics.  You define "facts" and "rules".  Then you can run a query which will use some kind of unification or constraint solving to determine if you can derive the appropriate value from the given facts and rules. You can intuitively model this by saying that a dependency graph is created where you start with facts, rules are then applied to each set of facts to create a larger set of facts, some of which are compound.  In the end you have a dependency graph where the same rule can create a new fact depending on which facts it's depending on. 

We can identify that the query semantics are doing something like pattern matching.  According to our previous description of types, that would mean we're querying via type.  For exhaustive search among all potential values of a pattern, this wouldn't halt for some cases.  The "type" must be adequately constrained.  In datalog, only values which have been defined would be checked against the pattern, so the output is always constrained to a finite number of values.  

So, in datalog you could say that you're programming at the type level.  This could explain why this type of programming can feel disorienting. 

We can directly extend this further to other relational queries.  We can consider each table to be a type.  The columns are product types.  A query defines a set of patterns which can be matched against subgraphs.
</details>

<details>
<summary>Next we can look at process calculi and their correspondence to types via sessions.</summary>

For a process calculus at first glance it is probably harder to find the connection.  However we just have to figure out where the dependency graph arises.  This is found in the sequence of calls between actors.  When A sends a message to B over a certain channel, this means B is listening for that message, which establishes the dependency.  So the graph is wired up via channels.  

When we then look at the idea of holes in that dependency graph which can be filled by many different subgraphs, we see that this corresponds to a process waiting for a message.  In the process calculus, we can imagine a truncated back and forth which could continue in one of a set of ways.  So we have an established sequence of interactions which creates within A and B a shared context to be continued in one of many ways... this is essentially the description of a protocol.  Session types are a particular way to type those protocols which allow agents A and B enough guarantees to type check the processes.
</details>


<details>

<summary> Multiple of these lenses can be applied at once and will look like effects to each other</summary>
Ultimately we can consider the evaluation mechanism of the entire computation graph to be a function World State -> ComputationGraph -> ComputationGraph.  This function will return a new computation graph with inputs added and some evaluation done to create a new graph.  This function controls the way the subgraph completing the arrow type is rewritten.  So if we have 2 separate evaluation mechanisms happening -- for instance a process calculus sending messages and a lambda calculus computation graph, we have 2 kinds of arrows.

But then from the perspective of the computational world, the process calculus arrows are external mutations to the graph, and visa versa.  This works well with the general conception of typed effects where the function has a sort of "color".

So rather than solving the function color problem, we massively expand it by realizing that any effect is a function color, and these colors might have some mixing.  We can consider IO for instance to be a DSL that happens to overlap with the computational domain.  And IO arrow presents the system outside the language with information and awaits an input that comes in the form of a subgraph.  Exceptions rewrite parts of the computation graph to "exception" nodes.  And type checkers rewrite parts of the graph to "type error" node.

So algebraic effects provide a sort of type system for these function colors. They can provide a kind of meta-type system that unites these various DSL's that are operating on the same dependency graph. 

In mathematical terms, this is essentially providing a quotient on 2 algebras on a monoid--the dependency graph. 
</details>


<details>
<summary>Coroutines also fall into this mix in a similar way, as does asynchronous programming in general, with some caveats.  </summary>

 A coroutine yielding is the equivalent of sending a response message.  A coroutine being called with next (or whatever triggers execution) is a message being passed the other way. Both sides can be viewed as process servers if you squint. 

But coroutines combine 2 instances of the type/computation model.  
A typed coroutine with message passing between the routines is equivalent to a session type or process calculus view.  Meanwhile the actual computations happening are also their own dependency graph.  These 2 dependency graphs can have overlap, however there is a major important conflict: the arrow type that defines functions.  

In the process dependency graph, arrows are messages sent over a channel.  In the computation dependency graph, they're functions where the variables are substituted. 

</details>


<details>
<summary>Looking through this lens, we can consider effects to be modificatinos to the computation graph during runtime</summary>
These subgraphs are modifications to the compuation graph during runtime.  For example, a subgraph may be added by arbitrary input, random generation, or retrieval from a file or network call. Even state, which is considered effectful in Haskell, would be copying/pointing to a subgraph from one part of a program's context to another. 

One thing to note about effects is that they require a handler.  This can also be viewed as a default argument, but they need some value to be passed in -- in the case of an arrow, a function.  We can consider this to be a special case of any other variable initialization whereby when a typed variable is created, a value must be supplied before evaluation can proceed. 
</details>


<details>
<summary> In the context of the workflow / task world, goals are types</summary>

Now let's consider tasks, in the sense of a "todo item".  Tasks are often modeled as some kind of coroutine.  A task/workflow may involve multiple actors/"processors".  These entities must pass signals back and forth to each other in some form or another.  Tasks may also involve many other kinds of actions including IO or computations.  

So a task is an initialized variable with a type, but which does not have a value assigned.  This prevents evaluation from proceding until the  value is supplied.  The process which is waiting for a value to be supplied can be said to be "listening" or "awaiting." 

With tasks the existence of the dependency graph is clear.  Subtasks complete tasks and hopefully update state which allows larger tasks to be marked as completed.

But what does this look like when we consider holes in the dependency graph?  We end up with a dependency graph which can be completed with any one of many different subroutines.  

But this is every task.  There's more than 1 way to skin any cat.  This would mean that any "todo" is a type.  They would be the actual details of how the task got done.  The actual execution of the task may have effects, etc. But the thing that is being represented by the data in a regular todo app is a type.  Then what would that make the actual values?  

If we step back to considering types as sets and map a correspondence to the sets versus members of a set, we see that goals or tasks are sets.  The type can be satisfied in any number of ways.  If the task is a hole, then completing it means filling that hole.

This makes sense because in the real world, a task is generally awaiting some input.  If you have a subtask, it's because the larger task needs some input.  For instace "build a house" will have somewhere a subtask of "buy lumber" because that gets input into the final product.  In a program, the task may be awaiting input like a name, a choice, or a completion status.  That output of the subtask later becomes an input of the parent task.  It becomes a value that fills the parent's hole.  

[Here's a paper](https://www.researchgate.net/publication/27470058_Workflow_Patterns) illustrating that tasks can be composed with all-of, one-of, or sequential compostion... a common practice for workflow engines.  This mirrors the Promise.any, Promise.all, and Promise.then which we find in Javascript.  In types these very naturally correspond to the sum type, product type, and arrow (if you assume no effects from the perspective of the promise graph) respectively.  

So we may be able to simplify task management and workflow engines by modeling tasks this way.  In the world of AI agents completing tasks, this will likely be a critical tool for managing complexity. And on the topic of AI...

</details>

<details>
<summary>Let's also look at neural nets since they're obviously dependency graphs of a kind. </summary>

Neural nets act differently during the inference versus training stages.  

First let's consider the direction the dependencies go.  When running inference, the inputs are the leaves.  The hidden and output layers minus the inputs then correspond to a type.  As you move deeper toward the output layer, the types are more general.  Finally, you get to the output. So we can consider this a form of type inference.  The nerual net equivalent of parsing data constructors of a value. 

We can also consider transformers, which selectively suppress inputs.  By suppressing activation so much that some leaves are effectively lopped off of the branches, they're essentially saying "these are the *types* of the thing I'm trying to infer".  From a certain angle, you could say that each output node represents a pattern and you're pattern matching on the input. 

Now let's think of the training phase, in which these types are actually defined.  When our loss is computed, and the weights are recalculated based on the gradient, we're modifying the type to be less likely to include that term.  Semantically this all checks out.  

But the training phase creates a corresponding graph that updates the other way.  In this gradient graph, the actual label is the "leaf node", with the gradient calculation directly depending on that.  As you move toward the input layer, you're calculating new gradients depending on the output layer and all layers in between.  I'm not sure how to understand this semeantically.  However it's interesting to view this from the lens of [this paper](http://strictlypositive.org/diff.pdf) (referenced earlier).  I would like to explore whether/how the numeric derivative involved in gradient descent, which is apparently semantically a derivative on some type, might have some correspondence to the semantic type derivative from that paper.

</details>



<details>
<summary>It's also interesting to consider other computer science concepts through the lenses of all these correspondences</summary>

Recursion is a complicating aspect of all this.  Variables determine the way things are wired up.  They can allow arbitrary wirings. Vanilla neural nets lack these capabilities, but it's interesting to consider a case where they weren't.  It's possible that this capability is emergent in transformer design.

The arbitrary names of channels in a process calculus correspond to the arbitrary names of variables -- they provide a way to wire chunks of immutable logic together.  This occurs at the value level, not the type level.  So in a task, this arbitrariness would have to do with how the results of one task get directed into the next.  

Cut free proofs correspond to point free programming.  In the other realms these correspond to not creating intermediate channels/tables/subtasks that can be removed.  Similarly in the task version, outputs from a task would not get moved from place to place unnecessarily.  In a neural net it would be layers that don't make any changes in inference. 


</details>


<details>
<summary>Advanced type systems like linear types or homotopy types can provide extremely powerful capabilities in the worlds of these various correspondences.</summary>

In the case of computation, linear types can provide constraints on how resources are allocated.  Homotopy types can go further and constrain what kinds of processes can be run.  

In the case of neural nets, I can't comprehend the effect that linear types would have.  Requiring that an input be consumed doesn't sound particularly useful, although it might help in interpretability.  If we view the neural nets as types, we may find that some patterns emerge that play the role of linear types.  

Homotopy types as well.  A neural net may take multiple paths to the same point of inference, and homotopy types might allow us to keep track of those multiple paths to understand multiple "lines of reasoning" that led to a certain inference pattern. 



</details>



