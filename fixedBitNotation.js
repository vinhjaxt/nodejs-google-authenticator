/* eslint-disable eqeqeq */
/**
 * FixedBitNotation.
 *
 * The FixedBitNotation class is for binary to text conversion. It
 * can handle many encoding schemes, formally defined or not, that
 * use a fixed number of bits to encode each character.
 *
 * @author Andre DeMarre
 */
class FixedBitNotation {
  /**
     * @param {Number}  bitsPerCharacter Bits to use for each encoded character
     * @param {String}  chars  Base character alphabet
     * @param {Boolean} rightPadFinalBits  How to encode last character
     * @param {Boolean} padFinalGroup  Add padding to end of encoded output
     * @param {String}  padCharacter Character to use for padding
     */
  constructor (bitsPerCharacter, chars = null, rightPadFinalBits = false, padFinalGroup = false, padCharacter = '=') {
    // Ensure validity of chars
    let charLength, radix
    if (typeof (chars) !== 'string' || (charLength = chars.length) < 2) {
      chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-,'
      charLength = 64
    }

    // Ensure validity of bitsPerCharacter
    if (bitsPerCharacter < 1) {
      // bitsPerCharacter must be at least 1
      bitsPerCharacter = 1
      radix = 2
    } else if (charLength < 1 << bitsPerCharacter) {
      // Character length of chars is too small for bitsPerCharacter
      // Set bitsPerCharacter to greatest acceptable value
      bitsPerCharacter = 1
      radix = 2

      while (charLength >= (radix <<= 1) && bitsPerCharacter < 8) {
        ++bitsPerCharacter
      }

      radix >>= 1
    } else if (bitsPerCharacter > 8) {
      // bitsPerCharacter must not be greater than 8
      bitsPerCharacter = 8
      radix = 256
    } else {
      radix = 1 << bitsPerCharacter
    }

    this.chars = chars
    this.bitsPerCharacter = bitsPerCharacter
    this.radix = radix
    this.rightPadFinalBits = rightPadFinalBits
    this.padFinalGroup = padFinalGroup
    this.padCharacter = padCharacter[0]
  }

  /**
     * Encode a string.
     *
     * @param {String} rawString Binary data to encode
     *
     * @return {String}
     */
  encode (rawString) {
    // Unpack string into an array of bytes
    const bytes = Buffer.from(rawString)
    const byteCount = bytes.length

    let encodedString = ''
    let byteIndex = 0
    let byte = bytes[0]
    let bitsRead = 0

    const chars = this.chars
    const bitsPerCharacter = this.bitsPerCharacter
    const rightPadFinalBits = this.rightPadFinalBits
    const padFinalGroup = this.padFinalGroup
    const padCharacter = this.padCharacter

    // Generate encoded output;
    // each loop produces one encoded character
    let oldBitCount, oldBits, newBitCount
    for (let c = 0; c < byteCount * 8 / bitsPerCharacter; ++c) {
      // Get the bits needed for this encoded character
      if (bitsRead + bitsPerCharacter > 8) {
        // Not enough bits remain in this byte for the current
        // character
        // Save the remaining bits before getting the next byte
        oldBitCount = 8 - bitsRead
        oldBits = byte ^ (byte >> oldBitCount << oldBitCount)
        newBitCount = bitsPerCharacter - oldBitCount

        if (byteIndex >= byteCount) {
          // Last bits; match final character and exit loop
          if (rightPadFinalBits) {
            oldBits <<= newBitCount
          }
          encodedString += chars[oldBits]

          if (padFinalGroup) {
            // Array of the lowest common multiples of
            // bitsPerCharacter and 8, divided by 8
            const lcmMap = { 1: 1, 2: 1, 3: 3, 4: 1, 5: 5, 6: 3, 7: 7, 8: 1 }
            const bytesPerGroup = lcmMap[bitsPerCharacter]
            const pads = bytesPerGroup * 8 / bitsPerCharacter - Math.ceil((rawString.length % bytesPerGroup) * 8 / bitsPerCharacter)
            encodedString += (padCharacter[0]).repeat(pads)
          }

          break
        }

        // Get next byte
        byteIndex++
        byte = bytes[byteIndex]
        bitsRead = 0
      } else {
        oldBitCount = 0
        newBitCount = bitsPerCharacter
      }

      // Read only the needed bits from this byte
      let bits = byte >> 8 - (bitsRead + newBitCount)
      bits ^= bits >> newBitCount << newBitCount
      bitsRead += newBitCount

      if (oldBitCount) {
        // Bits come from seperate bytes, add oldBits to bits
        bits = (oldBits << newBitCount) | bits
      }

      encodedString += chars[bits]
    }

    return encodedString
  }

  /**
     * Decode a string.
     *
     * @param {String} encodedString Data to decode
     * @param {Boolean} caseSensitive
     * @param {Boolean} strict  Returns null if encodedString contains
     *                            an undecodable character
     *
     * @return {String}
     */
  decode (encodedString, caseSensitive = true, strict = false) {
    if (!encodedString || typeof (encodedString) !== 'string') {
      // Empty string, nothing to decode
      return ''
    }

    const chars = this.chars
    const bitsPerCharacter = this.bitsPerCharacter
    const radix = this.radix
    const rightPadFinalBits = this.rightPadFinalBits
    const padCharacter = this.padCharacter

    let charmap
    // Get index of encoded characters
    if (this.charmap) {
      charmap = this.charmap
    } else {
      charmap = []

      for (let i = 0; i < radix; ++i) {
        charmap[chars[i]] = i
      }

      this.charmap = charmap
    }

    // The last encoded character is encodedString[lastNotatedIndex]
    let lastNotatedIndex = encodedString.length - 1

    // Remove trailing padding characters
    while (encodedString[lastNotatedIndex] == padCharacter[0]) {
      encodedString = encodedString.substr(0, lastNotatedIndex)
      --lastNotatedIndex
    }

    const rawString = []
    let byte = 0
    let bitsWritten = 0

    // Convert each encoded character to a series of unencoded bits
    for (let c = 0; c <= lastNotatedIndex; ++c) {
      if (undefined === charmap[encodedString[c]] && !caseSensitive) {
        // Encoded character was not found; try other case
        let cLower, cUpper
        if (undefined !== charmap[cUpper = encodedString[c].toUpperCase()]) {
          charmap[encodedString[c]] = charmap[cUpper]
        } else if (undefined !== charmap[cLower = encodedString[c].toLowerCase()]) {
          charmap[encodedString[c]] = charmap[cLower]
        }
      }

      if (undefined !== charmap[encodedString[c]]) {
        let bitsNeeded = 8 - bitsWritten
        let unusedBitCount = bitsPerCharacter - bitsNeeded
        let newBits

        // Get the new bits ready
        if (bitsNeeded > bitsPerCharacter) {
          // New bits aren't enough to complete a byte; shift them
          // left into position
          newBits = charmap[encodedString[c]] << bitsNeeded - bitsPerCharacter
          bitsWritten += bitsPerCharacter
        } else if (c != lastNotatedIndex || rightPadFinalBits) {
          // Zero or more too many bits to complete a byte;
          // shift right
          newBits = charmap[encodedString[c]] >> unusedBitCount
          bitsWritten = 8 // bitsWritten += bitsNeeded;
        } else {
          // Final bits don't need to be shifted
          newBits = charmap[encodedString[c]]
          bitsWritten = 8
        }

        byte |= newBits

        if (bitsWritten == 8 || c == lastNotatedIndex) {
          // Byte is ready to be written
          rawString.push(byte)

          if (c != lastNotatedIndex) {
            // Start the next byte
            bitsWritten = unusedBitCount
            byte = (charmap[encodedString[c]] ^ (newBits << unusedBitCount)) << 8 - bitsWritten
          }
        }
      } else if (strict) {
        // Unable to decode character; abort
        return null
      }
    }

    return Buffer.from(rawString)
  }
}

exports = module.exports = FixedBitNotation
