import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { RateLimitService } from '../rate-limit/rate-limit.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private rateLimitService: RateLimitService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = String(
      localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    ).trim();


    if (token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    } else {
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        this.rateLimitService.registerHttpRateLimit(
          request.method,
          request.url,
          error
        );
        return throwError(() => error);
      })
    );
  }
}
