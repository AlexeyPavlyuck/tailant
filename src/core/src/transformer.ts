import type { FilePath, RawFile, TransformerFn } from 'tailwindcss/types/config'
import type { Config } from 'tailwindcss'

import resolveConfig from 'tailwindcss/resolveConfig'

import { isArray, isEmpty, isFunction, isObject, isRawFile, isTransformerFunction } from './utils/tools'
import { Processor } from './lib'
import { extendTailwindMerge } from "tailwind-merge"

export { validators } from 'tailwind-merge'

/**
 * Returns a function that applies a list of TransformerFns to a given input
 * string, with each function being applied to the result of the previous
 * function. TransformerFns are functions that take a string as input and
 * return a string. The returned function takes a single string parameter.
 *
 * @param {TransformerFn[]} funcs - An array of TransformerFns to apply to the
 * input string, in the order they are provided.
 * @return {(input: string) => string} A function that applies the list of
 * TransformerFns to the input string, in the order they are provided.
 */
const pipeline = (...funcs: TransformerFn[]) => {
  return (input: string) => funcs.reduce((acc, func) => func(acc), input)
}

/**
 * Returns a list of unique extensions from the given ContentFile array,
 * excluding 'html' extensions. If an extension is not present in a file, it
 * will be extracted from the file's name or from a pattern inside the name.
 *
 * @param {ContentFile} files - an array of ContentFile objects to extract
 * extensions from
 * @return {string[]} a list of unique extensions from the given ContentFile
 * array, excluding 'html' extensions
 */
type ContentFile = (FilePath | RawFile)[]
const getExtensions = (files: ContentFile): string[] => {
  const extensions = files
    .map((file) => {
      // If the file is a raw file, return its extension
      if (isRawFile(file)) {
        return file.extension
      }

      const regxpExt = /\.\w+/g
      let fileExt: RegExpMatchArray | string[] | null

      // If the file has an extension, extract it using a regular expression
      fileExt = file.match(regxpExt)

      // If the file does not have an extension, extract the extensions from a curly brace notation
      if (!fileExt) {
        fileExt = file.split('{')

        const lastItem = fileExt.pop()

        if (!!lastItem) {
          fileExt = lastItem.replace('}', '').split(',')
        }
      }

      return fileExt.map((ext) => ext.replace('.', '').split('.')).flat()
    })
    .flatMap((ext) => ext)

  const result = Array.from(new Set(extensions)).filter((ext): ext is string => typeof ext === 'string')

  // Filter out 'html' extensions
  return result.filter((ext) => ext !== 'html')
}

export let extendTwMerge: ReturnType<typeof extendTailwindMerge> | undefined

/**
 * Applies a tailant to the given configuration object, modifying it in place.
 *
 * @param {Config} input - the configuration object to process
 * @param extendTwMergeConfig - config extendTailwindMerge
 * @return {Config} the processed configuration object
 */
export function withTailant(input: Config, extendTwMergeConfig?: Parameters<typeof extendTailwindMerge>[0]) {
  extendTwMerge = extendTailwindMerge(extendTwMergeConfig || {})

  // Resolve the configuration object
  let config = resolveConfig(input)

  // If there are no files to process, return the original config
  if (isEmpty(config.content?.files) || !isArray(config.content?.files)) {
    return config
  }

  /**
   * Transforms the given content using the Processor transformer.
   *
   * @param {string} content - The content to be transformed.
   * @return {unknown} The transformed content.
   */
  const transformer = (content: string) => {
    return Processor.transformer(content)
  }

  // If there is no custom transform function, use the default transformer for all file extensions
  const customTransform = config.content.transform

  if (isEmpty(customTransform)) {
    const extensions = getExtensions(config.content.files)
    const transformEntries = extensions.map((ext) => [ext, transformer])

    config.content.transform = Object.fromEntries(transformEntries)

    return config
  }

  // If the custom transform function is a function, use both the default transformer and the custom transform for all file extensions
  if (isFunction(customTransform)) {
    const extensions = getExtensions(config.content.files)
    const transformEntries = extensions.map((ext) => [ext, pipeline(transformer, customTransform)])

    config.content.transform = Object.fromEntries(transformEntries)

    return config
  }

  // If the custom transform function is an object, use the default transformer for file extensions without a custom transform, and use a combination of the default transformer and each custom transform for file extensions with a custom transform
  if (isObject(customTransform)) {
    const extensions = getExtensions(config.content.files)
    const transformEntries = extensions.map((ext) => {
      const transformFn = customTransform[ext]
      const validTransform = isTransformerFunction(transformFn)

      return validTransform ? [ext, pipeline(transformer, transformFn)] : [ext, transformer]
    })

    config.content.transform = Object.fromEntries(transformEntries)

    return config
  }

  // Return the processed config object
  return config
}
