import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ArrowLeft } from "lucide-react";

interface ColorPaletteProps {
  onBack?: () => void;
}

export function ColorPalette({ onBack }: ColorPaletteProps) {
  const colors = [
    { name: "background", desc: "메인 배경색" },
    { name: "foreground", desc: "메인 텍스트 색상" },
    { name: "card", desc: "카드 배경색" },
    { name: "card-foreground", desc: "카드 텍스트 색상" },
    { name: "popover", desc: "팝오버 배경색" },
    { name: "popover-foreground", desc: "팝오버 텍스트 색상" },
    { name: "primary", desc: "브랜드 메인 색상" },
    { name: "primary-foreground", desc: "Primary 위 텍스트" },
    { name: "secondary", desc: "보조 색상" },
    { name: "secondary-foreground", desc: "Secondary 위 텍스트" },
    { name: "muted", desc: "덜 강조된 색상" },
    { name: "muted-foreground", desc: "Muted 위 텍스트" },
    { name: "accent", desc: "강조 색상" },
    { name: "accent-foreground", desc: "Accent 위 텍스트" },
    { name: "destructive", desc: "삭제/에러 색상" },
    { name: "destructive-foreground", desc: "Destructive 위 텍스트" },
    { name: "border", desc: "테두리 색상" },
    { name: "input", desc: "입력 필드 테두리" },
    { name: "ring", desc: "포커스 링 색상" },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          {onBack && (
            <Button
              variant="ghost"
              onClick={onBack}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                shadcn/ui Color Palette
              </h1>
              <p className="text-muted-foreground">
                현재 테마의 모든 색상 토큰 (라이트/다크 모드 전환 가능)
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘P</kbd> to toggle
            </div>
          </div>
        </div>

        {/* Color Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {colors.map(({ name, desc }) => {
            const bgClass = `bg-${name.replace("-foreground", "")}`;
            const textClass = name.includes("foreground")
              ? `text-${name}`
              : `text-${name}-foreground`;

            return (
              <Card key={name} className="overflow-hidden">
                {/* Color Preview */}
                <div
                  className={`h-32 ${bgClass} ${textClass} flex items-center justify-center p-4`}
                >
                  <div className="text-center">
                    <div className="text-sm font-medium">Aa</div>
                    <div className="text-xs opacity-80">Text Sample</div>
                  </div>
                </div>

                {/* Color Info */}
                <div className="p-4 bg-card">
                  <div className="font-mono text-sm font-semibold text-foreground mb-1">
                    {name}
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {desc}
                  </div>

                  {/* CSS Variable */}
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-muted-foreground">
                      CSS: <span className="text-foreground">var(--{name})</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      Tailwind: <span className="text-foreground">{bgClass}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Button Variants Demo */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Button Variants
          </h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="default">Default (Primary)</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </div>

        {/* Comparison Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 bg-primary text-primary-foreground">
            <h3 className="font-bold mb-2">Primary Card</h3>
            <p className="text-sm opacity-90">
              브랜드 메인 색상을 사용한 카드
            </p>
          </Card>

          <Card className="p-6 bg-secondary text-secondary-foreground">
            <h3 className="font-bold mb-2">Secondary Card</h3>
            <p className="text-sm opacity-90">
              보조 색상을 사용한 카드
            </p>
          </Card>

          <Card className="p-6 bg-destructive text-destructive-foreground">
            <h3 className="font-bold mb-2">Destructive Card</h3>
            <p className="text-sm opacity-90">
              에러/경고 색상을 사용한 카드
            </p>
          </Card>
        </div>

        {/* Note about missing colors */}
        <Card className="mt-12 p-6 border-yellow-500 border-2">
          <h3 className="font-bold text-foreground mb-2">⚠️ 참고사항</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>
              <strong>success</strong> 색상은 기본 제공되지 않음
            </li>
            <li>
              <strong>warning</strong> 색상도 없음 (필요시 추가 가능)
            </li>
            <li>
              <strong>info</strong> 색상도 없음
            </li>
            <li>
              성공/실패 표시가 필요하면 Tailwind의 <code className="bg-muted px-1 py-0.5 rounded text-xs">green-500</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">red-500</code> 등을 직접 사용하거나 CSS 변수로 추가 필요
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
