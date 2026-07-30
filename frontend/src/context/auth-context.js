import { createContext } from 'react'

/**
 * Kept in its own file (rather than alongside AuthProvider in
 * AuthContext.jsx) because Vite's react-refresh lint rule requires
 * component files to only export components — see AuthContext.jsx
 * and useAuth.js, which both import this.
 */
export const AuthContext = createContext(undefined)