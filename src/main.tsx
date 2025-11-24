import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Home from '@/components/pages/Home.tsx'
import PostsPage from '@/components/pages/Posts'
import FosPage from '@/components/pages/Fos'
import { posts } from '@/posts'
import './App.css'
import './globals.css'

import {
  createHashRouter,
  RouterProvider,
} from "react-router-dom";

import { ThemeProvider } from '@/components/theme-provider'

import ErrorPage from "@/components/pages/Error";

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <App><ErrorPage /></App>,
    children: [
      {
        path: "/",
        element: <Home position="" />,
      },
      {
        path: "/fos",
        element: <FosPage />,
      },
      {
        path: "/contact",
        element: <Home position="contact" />,
      },
      {
        path: "/skills",
        element: <Home position="skills" />,
      },
      {
        path: "/work",
        element: <Home position="work" />,
      },
      {
        path: "/about",
        element: <Home position="about" />,
      },
      {
        path: "/blog",
        element: <PostsPage />,
      },
      // Dynamically generate routes for all posts at build time
      ...posts.map(post => ({
        path: `/blog/${post.slug}`,
        element: React.createElement(post.component),
      })),
    ]
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
)
