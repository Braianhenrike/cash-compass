import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/pages/LoginPage";

const signInMock = vi.fn();
const signUpMock = vi.fn();

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    signIn: signInMock,
    signUp: signUpMock,
  }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    signInMock.mockReset();
    signUpMock.mockReset();
    signInMock.mockResolvedValue(undefined);
    signUpMock.mockResolvedValue(undefined);
  });

  function renderPage() {
    return render(
      <MemoryRouter
        initialEntries={["/login"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("envia o formulario de login", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar no CashCompass" }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith("braianhgomes12@gmail.com", "123456");
    });
  }, 15_000);

  it("troca para cadastro e envia o formulario de criacao", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "abcdef" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Criar conta" }).at(-1)!);

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith({
        email: "braianhgomes12@gmail.com",
        password: "abcdef",
        fullName: "Braianhenrike",
      });
    });
  }, 15_000);
});
