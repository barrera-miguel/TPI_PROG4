export function Spinner({ small }: { small?: boolean }) {
  return <div className={small ? 'spinner spinner-sm' : 'spinner'} />
}
export function SpinnerCenter() {
  return <div className="spinner-center"><Spinner /></div>
}
