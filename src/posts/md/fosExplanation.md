---
title: "Fosforescent Evaluation Mechanism"
summary: "Exploring environment representation and variable bindings in a graph-based programming language"
image: "/blog-images/fosExplanation.png"
date: "2025-01-10"
---

I'm working on building[Fosforescent](https://fosforescent.substack.com/p/fosforescent-as-a-programming-language).Currently I've been working on implementing a very basic evaluation mechanism.Here's what I'm running into.

            First, the way I’m storing the nodes is with a single “store” class, which contains a map from the content ID to the content of the node.While trying to implement a lisp - like eval / apply mechanism, I realized that I don’t have a great way of representing the environment, or the set of variable bindings.

        I would like to eventually treat the store like a database.Something very similar to Cozo DB, from what I have gathered of their description(haven’t looked at their implementation much yet).This would allow me to implement the graph rewrite rules, as well as things like pattern matching and type checking with database queries on the graph.Why not just use Cozo ? I think I would need to be able to access the actual storage structures.I’m presuming that would require me to fork it and exposing some things that aren’t really meant to be used that way.For now it’s easier to just stick with what I have, but if I get to the point where I’m implementing more serious database functionality in the store, I’ll look deeper into that.

        The current issue is: if I treat the environment itself as a node, that’s convenient, but then I end up with the environment of each scope getting written into the store as a node itself.There’s something that doesn’t seem right about that.I think my main concern is that when I go to query available node matching a certain type for certain operations, it’s going end up returning an environment node, which is not really supposed to be exposed to the user in that way.So the question is whether that would ever actually happen, and if it did, what would it look like.Maybe it would end up being a feature.If it’s bad, then what do I have to do to fix it ?

            Stepping through the problem, let’s imagine we have some scope like the following:
        
        {
            let x = 3
            let y = 5
            return add({ left: x, right: y })
        }
        That function evaluation would end up creating a node that has all let expressions which defined the available environment.

            The ways that a query would return that block is if I specifically queried for those let expressions, or if I queried for a pattern that somehow matched any let expression on the left, followed by an expression that matched whatever pattern were on the right.

                If the user explicitly made a query which contained this info, they would end up with a node they never created.

        Another solution would be to make it part of the evaluation semantics that the aggregated environment from the parent gets put into the right node of the currently evaluating expression.It would have to be the right node because the left is eagerly evaluated and we don’t want to eagerly evaluate the whole environment.We could make this slightly less redundant by only including that environment if it’s required by a matching pattern on the left node.E.g.if the left node has a `let x` constructor with an empty right(or whatever I end up using to indicate that it’s a pattern), then perhaps this would cause the evaluation mechanism to search the environment for a`let x` definition.

        In terms of semantic behavior this might end up being something like Scala’s implicit arguments.This seems like a better solution than having a separate node just for the environment.What we would have instead is that as part of a node’s evaluation, any un - matched patterns from the left side would be searched for in the environment.If none were found, then the expression would be highlighted as requiring that argument as input.
