/**
 * Teste smoke do Design System (DS).
 *
 * Renderiza cada primitivo via SSR e confere:
 * - tokens semânticos presentes nas classes Tailwind,
 * - atributos ARIA esperados,
 * - ausência de cores literais proibidas (cyan/blue-6/red-7/etc).
 *
 * Não substitui testes individuais de comportamento, mas dá segurança
 * rápida de que o catálogo está consistente.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Field,
  Input,
  Select,
  Textarea,
  Checkbox,
  Switch,
  Badge,
  Chip,
  Avatar,
  Icon,
  IconWrap,
  ProgressBar,
  Stepper,
  Tabs,
  TabList,
  TabPanel,
  EmptyState,
  Section,
  PageHeader,
  Breadcrumb,
  BreadcrumbItem,
  InfoBox,
  FormSection,
  FormFooter,
  FormGrid,
  KpiCard,
  Segmented,
  RadioCard,
} from "./index";

function render(node: React.ReactNode): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <>{node}</>,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

const FORBIDDEN = [
  "bg-cyan-",
  "bg-blue-6",
  "bg-blue-7",
  "text-blue-6",
  "text-blue-7",
  "bg-red-7",
  "text-red-7",
  "bg-amber-50",
  "text-amber-6",
];

describe("DS primitives", () => {
  it("Button primary usa bg-accent e ring-accent", () => {
    const html = render(<Button>OK</Button>);
    expect(html).toContain("bg-accent");
    expect(html).toContain("focus-visible:ring-accent");
    expect(html).toContain('type="button"');
  });

  it("Button loading exibe spinner e aria-busy", () => {
    const html = render(<Button loading>OK</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-testid="spinner"');
  });

  it("Button variant danger não usa vermelho literal", () => {
    const html = render(<Button variant="danger">X</Button>);
    expect(html).toContain("bg-danger");
    expect(html).not.toContain("bg-red-7");
  });

  it("Card variants expõem tokens", () => {
    const html = render(<Card variant="hover">x</Card>);
    expect(html).toContain("bg-surface");
    expect(html).toContain("border-border");
  });

  it("CardHeader tem eyebrow + título + descrição", () => {
    const html = render(
      <CardHeader eyebrow="01" title="T" description="d" />,
    );
    expect(html).toContain("01");
    expect(html).toContain("T");
    expect(html).toContain("d");
  });

  it("Field + Input associado por id", () => {
    const html = render(
      <Field label="Nome" name="nome" required>
        <Input label="Nome" name="nome" required />
      </Field>,
    );
    expect(html).toContain('for="nome"');
    expect(html).toContain('id="nome"');
    expect(html).toContain('aria-required="true"');
  });

  it("Input aceita className extra", () => {
    const html = render(
      <Input label="E" name="email" className="max-w-xs" />,
    );
    expect(html).toContain("max-w-xs");
  });

  it("Select renderiza options", () => {
    const html = render(
      <Select
        label="S"
        name="s"
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    expect(html).toContain('value="a"');
    expect(html).toContain("A");
  });

  it("Textarea tem rows customizável", () => {
    const html = render(<Textarea label="t" name="t" rows={6} />);
    expect(html).toContain('rows="6"');
  });

  it("Checkbox + Switch renderizam com label", () => {
    expect(render(<Checkbox label="x" name="x" />)).toContain("x");
    const sw = render(<Switch name="s" label="S" />);
    expect(sw).toContain('role="switch"');
    expect(sw).toContain("S");
  });

  it("Badge tones usam bg-success-soft etc", () => {
    expect(render(<Badge tone="success">x</Badge>)).toContain(
      "bg-success-soft",
    );
    expect(render(<Badge tone="accent">x</Badge>)).toContain("bg-accent-soft");
  });

  it("Avatar exibe iniciais", () => {
    expect(render(<Avatar name="Maria de Teste" />)).toContain("MT");
  });

  it("Icon + IconWrap compõem corretamente", () => {
    const html = render(
      <IconWrap tone="accent">
        <Icon name="users" />
      </IconWrap>,
    );
    expect(html).toContain("bg-accent-soft");
  });

  it("ProgressBar tem role progressbar", () => {
    const html = render(<ProgressBar value={32} />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="32"');
  });

  it("Stepper renderiza etapas com estado active/done", () => {
    const html = render(
      <Stepper
        steps={[
          { label: "A" },
          { label: "B", active: true },
          { label: "C", done: true },
        ]}
      />,
    );
    expect(html).toContain("A");
    expect(html).toContain('aria-current="step"');
  });

  it("Tabs renderizam lista e painel ativo", () => {
    const html = render(
      <Tabs value="b" onValueChange={() => {}}>
        <TabList
          items={[
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ]}
        />
        <TabPanel value="b">conteúdo</TabPanel>
      </Tabs>,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("conteúdo");
  });

  it("EmptyState tem título e descrição", () => {
    const html = render(
      <EmptyState title="vazio" description="nada aqui" />,
    );
    expect(html).toContain("vazio");
    expect(html).toContain("nada aqui");
  });

  it("Section + PageHeader padronizam cabeçalhos", () => {
    expect(render(<PageHeader title="t" />)).toContain("<h1");
    expect(render(<Section title="t"><>x</></Section>)).toContain("<h2");
  });

  it("Breadcrumb mostra trilha com aria-current", () => {
    const html = render(
      <Breadcrumb>
        <BreadcrumbItem href="/x">X</BreadcrumbItem>
        <BreadcrumbItem current>Y</BreadcrumbItem>
      </Breadcrumb>,
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Y");
  });

  it("InfoBox tem role=alert em warning", () => {
    const html = render(<InfoBox tone="warning" title="x">msg</InfoBox>);
    expect(html).toContain('role="alert"');
  });

  it("FormSection + FormFooter padronizam formulário", () => {
    const html = render(
      <FormSection title="Dados">
        <FormGrid>
          <span>1</span>
          <span>2</span>
        </FormGrid>
      </FormSection>,
    );
    expect(html).toContain("Dados");
    expect(html).toContain("grid");
    expect(html).toContain("1");
  });

  it("FormFooter alinha à direita", () => {
    const html = render(<FormFooter>ok</FormFooter>);
    expect(html).toContain("justify-end");
  });

  it("KpiCard aceita delta up/down", () => {
    expect(render(<KpiCard label="L" value={1} delta={{ value: "+2", direction: "up" }} />)).toContain("text-success");
    expect(render(<KpiCard label="L" value={1} delta={{ value: "-2", direction: "down" }} />)).toContain("text-danger");
  });

  it("Segmented renderiza grupo radio", () => {
    const html = render(
      <Segmented
        value="a"
        onChange={() => {}}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-checked="true"');
  });

  it("RadioCard tem label e input radio", () => {
    const html = render(
      <RadioCard value="in" label="Entrada" description="+" />,
    );
    expect(html).toContain('type="radio"');
    expect(html).toContain('value="in"');
    expect(html).toContain("Entrada");
  });

  it("Nenhum primitivo usa cor Tailwind literal proibida", () => {
    const nodes = [
      <Button key="b">x</Button>,
      <Card key="c">x</Card>,
      <Input key="i" label="x" name="x" />,
      <Field key="f" label="x" name="x">x</Field>,
      <Select key="s" label="x" name="x" options={[{ value: "1", label: "1" }]} />,
      <Badge key="bd" tone="success">x</Badge>,
      <Chip key="ch" tone="warning">x</Chip>,
      <Avatar key="av" name="X" />,
      <ProgressBar key="p" value={1} />,
      <Switch key="sw" name="x" label="x" />,
    ];
    const html = render(<>{nodes}</>);
    for (const cls of FORBIDDEN) {
      expect(html, `achou classe proibida: ${cls}`).not.toContain(cls);
    }
  });
});
