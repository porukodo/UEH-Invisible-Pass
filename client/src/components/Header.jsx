export default function Header({ title, dark = true }) {
  return (
    <header
      className={`${dark ? 'bg-ueh-green text-white' : 'bg-background text-ueh-green'} transition-colors duration-300 flex justify-center items-center w-full px-4 py-3 sticky top-0 z-50`}
    >
      <h1 className="font-bold text-lg select-none">{title}</h1>
    </header>
  );
}
