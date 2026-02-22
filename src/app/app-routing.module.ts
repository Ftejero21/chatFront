import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InicioComponent } from './Components/inicio/inicio/inicio.component';
import { LoginComponent } from './Components/login/login/login.component';

import { AdministracionComponent } from './Components/administracion/administracion/administracion.component';

const routes: Routes = [
  {path:'',component:LoginComponent},
  {path:'login',component:LoginComponent},
  { path: 'inicio', component: InicioComponent },  // Ruta raíz que carga InicioComponent
  { path: 'administracion', component: AdministracionComponent } // Ruta para el panel de admin
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
