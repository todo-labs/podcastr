import * as React from "react"

function getCurrentPathname() {
  if (typeof window === "undefined") {
    return "/"
  }

  return window.location.pathname || "/"
}

export function navigate(to: string) {
  if (typeof window === "undefined") {
    return
  }

  window.history.pushState({}, "", to)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function usePathname() {
  const [pathname, setPathname] = React.useState(getCurrentPathname)

  React.useEffect(() => {
    const handlePopState = () => {
      setPathname(getCurrentPathname())
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  return pathname
}

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

export function Link({ href, onClick, ...props }: LinkProps) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) {
      return
    }

    if (
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return
    }

    event.preventDefault()
    navigate(href)
  }

  return <a href={href} onClick={handleClick} {...props} />
}

export function useNavigate() {
  return navigate
}
