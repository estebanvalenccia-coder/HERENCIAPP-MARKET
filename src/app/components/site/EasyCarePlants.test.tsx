import { render, screen } from "@testing-library/react";
import { EasyCarePlants } from "./EasyCarePlants";

test("renders no plants message when catalog is empty", () => {
  render(<EasyCarePlants catalog={[]} />);
  expect(screen.getByText(/No hay plantas fáciles de cuidar disponibles/i)).toBeInTheDocument();
});
