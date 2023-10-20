import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Home from '@/components/pages/Home.tsx'
import './App.css'
import './globals.css'

import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import { ThemeProvider } from '@/components/theme-provider'

import ErrorPage from "@/components/pages/Error";

const router = createBrowserRouter([
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
