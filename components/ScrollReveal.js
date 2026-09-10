import { useRouter } from 'next/router'
import { useEffect } from 'react'

/**
 * Lightweight scroll reveal controller.
 *
 * A single native IntersectionObserver handles all reveal targets. The
 * MutationObserver keeps dynamically appended list items visible as well.
 */
export default function ScrollReveal() {
  const router = useRouter()

  useEffect(() => {
    let frameId
    let intersectionObserver
    let mutationObserver
    const selector = '.scroll-reveal:not(.animated)'
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    )?.matches

    const reveal = element => {
      const delay = element.getAttribute('data-reveal-delay')
      const duration = element.getAttribute('data-reveal-duration')

      if (delay) {
        element.style.animationDelay = delay
      }
      if (duration) {
        element.style.animationDuration = duration
      }

      element.classList.add('animated')
      intersectionObserver?.unobserve(element)
    }

    const observeElements = root => {
      if (!root) {
        return
      }

      if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector)) {
        if (reduceMotion || !window.IntersectionObserver) {
          reveal(root)
        } else {
          intersectionObserver?.observe(root)
        }
      }

      root.querySelectorAll?.(selector).forEach(element => {
        if (reduceMotion || !window.IntersectionObserver) {
          reveal(element)
        } else {
          intersectionObserver?.observe(element)
        }
      })
    }

    if (window.IntersectionObserver && !reduceMotion) {
      intersectionObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              reveal(entry.target)
            }
          })
        },
        {
          rootMargin: '0px 0px -8% 0px',
          threshold: 0.01
        }
      )
    }

    const setup = () => {
      observeElements(document)

      const mutationRoot = document.getElementById('theme-heo')
      if (mutationRoot && window.MutationObserver) {
        mutationObserver = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                observeElements(node)
              }
            })
          })
        })
        mutationObserver.observe(mutationRoot, {
          childList: true,
          subtree: true
        })
      }
    }

    frameId = window.requestAnimationFrame(setup)

    return () => {
      window.cancelAnimationFrame(frameId)
      intersectionObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [router.asPath])

  return null
}
