
export const log = console.log

export const css = {
  fromFile(url) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.append(link)
  },
  fromString(string) {
    const style = document.createElement('style')
    style.textContent = string
    document.head.append(style)
  } 
}
