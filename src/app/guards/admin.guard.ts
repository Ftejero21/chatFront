import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../Service/auth/auth.service';
import { UsuarioDTO } from '../Interface/UsuarioDTO';

@Injectable({
  providedIn: 'root',
})
export class AdminGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> | UrlTree {
    const token = String(localStorage.getItem('token') || '').trim();
    const usuarioId = Number(localStorage.getItem('usuarioId'));

    if (!token || !Number.isFinite(usuarioId) || usuarioId <= 0) {
      return this.router.createUrlTree(['/login']);
    }

    return this.authService.getById(usuarioId).pipe(
      map((usuario: UsuarioDTO) => {
        const roles = Array.isArray(usuario?.roles) ? usuario.roles : [];
        const isAdmin = roles.some((role) => {
          const normalized = String(role || '').trim().toUpperCase();
          return normalized === 'ADMIN' || normalized === 'ROLE_ADMIN';
        });
        return isAdmin ? true : this.router.createUrlTree(['/inicio']);
      }),
      catchError(() => of(this.router.createUrlTree(['/login'])))
    );
  }
}
