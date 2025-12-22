import { Button } from "../ui/button";
import { Card } from "../ui/card";
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

  const chartColors = [
    { name: "chart-1", desc: "차트 색상 1 (Primary)" },
    { name: "chart-2", desc: "차트 색상 2 (Secondary)" },
    { name: "chart-3", desc: "차트 색상 3 (Accent)" },
    { name: "chart-4", desc: "차트 색상 4" },
    { name: "chart-5", desc: "차트 색상 5" },
  ];

  const kattleColors = [
    { name: "kattle-ari", desc: "Kattle 아리 (연두)" },
    { name: "kattle-bada", desc: "Kattle 바다 (파랑)" },
    { name: "kattle-chorong", desc: "Kattle 초롱 (초록)" },
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

        {/* Chart Colors */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Chart Colors
          </h2>
          <p className="text-muted-foreground mb-4">
            차트 및 데이터 시각화에 사용되는 색상
          </p>
          <div className="flex flex-wrap gap-4">
            {chartColors.map(({ name, desc }) => (
              <div key={name} className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 rounded-lg border border-border shadow-sm"
                  style={{ backgroundColor: `hsl(var(--${name}))` }}
                />
                <div className="text-center">
                  <div className="font-mono text-xs font-semibold text-foreground">
                    {name}
                  </div>
                  <div className="text-xs text-muted-foreground max-w-[80px]">
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Chart Bar Demo */}
          <div className="mt-6 flex items-end gap-2 h-32">
            {chartColors.map(({ name }, index) => (
              <div
                key={name}
                className="w-12 rounded-t-md"
                style={{
                  backgroundColor: `hsl(var(--${name}))`,
                  height: `${((index + 1) * 20) + 20}%`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Kattle Logo Colors */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Kattle Logo Colors
          </h2>
          <p className="text-muted-foreground mb-4">
            Kattle 로고에 사용되는 브랜드 색상
          </p>
          <div className="flex flex-wrap gap-6">
            {kattleColors.map(({ name, desc }) => (
              <Card key={name} className="overflow-hidden w-48">
                <div
                  className="h-24 flex items-center justify-center"
                  style={{ backgroundColor: `hsl(var(--${name}))` }}
                >
                  <span className="text-white font-bold text-lg drop-shadow-md">
                    {name.replace("kattle-", "").toUpperCase()}
                  </span>
                </div>
                <div className="p-3 bg-card">
                  <div className="font-mono text-sm font-semibold text-foreground mb-1">
                    {name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {desc}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mt-2">
                    var(--{name})
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {/* Kattle Logo Demo */}
          <div className="mt-6 flex items-center gap-4">
            <div className="flex gap-1">
              {kattleColors.map(({ name }) => (
                <div
                  key={name}
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: `hsl(var(--${name}))` }}
                />
              ))}
            </div>
            <span className="text-lg font-bold text-foreground">Kattle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
