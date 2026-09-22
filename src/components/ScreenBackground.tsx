import Image from "next/image";
import bgSkyGrass from "../../public/assets/bg-sky-grass.png";

export default function ScreenBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <Image
        src={bgSkyGrass}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover blur-[2.4px] scale-105"
      />
    </div>
  );
}
