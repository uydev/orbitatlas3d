import useAppStore from '../store/useAppStore'

export default function SearchBar(){
  const { searchQuery, setSearchQuery } = useAppStore()
  return (
    <input 
      className="flex-1 px-2 py-1 rounded bg-zinc-800" 
      placeholder="Search satellites..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  )
}



