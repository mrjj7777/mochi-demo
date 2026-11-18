import { createContext, useContext } from 'react'
import { flavours } from '../brand'
import type { Flavour } from '../types/mochi'

export type FlavourContextValue = {
  flavour: Flavour
  setFlavour: (flavour: Flavour) => void
  activeSection: string
  setActiveSection: (id: string) => void
}

export const FlavourContext = createContext<FlavourContextValue>({
  flavour: flavours[0],
  setFlavour: () => {},
  activeSection: 'hero',
  setActiveSection: () => {},
})

export const useFlavour = () => useContext(FlavourContext)
