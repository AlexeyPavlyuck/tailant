import { Processor, extendTwMerge } from '../../core'
import processClassName from './process-class-name'

/**
 * Process an unknown number of inputs into a Tailwind class name.
 *
 * @param {unknown[]} args - unknown number of inputs to be processed
 * @return {string} - processed Tailwind class name
 */
export function css(...args: unknown[]): string {
  // Process class name from input arguments
  // Process variant groups from class name
  // Process merging from class name
  // Return the final processed Tailwind class name

  return extendTwMerge?.(Processor.transformer(processClassName(args))) || ''
}
